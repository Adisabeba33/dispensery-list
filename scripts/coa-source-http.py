"""Sequential, robots-aware HTTP reader for explicitly published document links."""
import json, re, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlsplit, urljoin

UA = 'the-flower-index/1.33.0 (+https://github.com/Adisabeba33/dispensery-list)'
TOKEN = 'the-flower-index'
MIN_DELAY = 2.1
class SourceBlocked(Exception): pass

def robot_rules(text, token=TOKEN):
    groups=[]; group=None; started=False
    for raw in text.splitlines():
        line=raw.split('#',1)[0].strip()
        if ':' not in line: continue
        key,value=(v.strip() for v in line.split(':',1)); key=key.lower()
        if key=='user-agent':
            if group is None or started: group={'agents':[], 'rules':[], 'delay':0}; groups.append(group); started=False
            group['agents'].append(value.lower())
        elif group is not None:
            started=True
            if key in ('allow','disallow') and value: group['rules'].append((value,key=='allow'))
            elif key=='crawl-delay':
                try: group['delay']=max(group['delay'],float(value))
                except ValueError: pass
    specific=[(len(a),g) for g in groups for a in g['agents'] if a!='*' and token.lower().startswith(a)]
    selected=[g for n,g in specific if n==max(n for n,g in specific)] if specific else [g for g in groups if '*' in g['agents']]
    return {'rules':[r for g in selected for r in g['rules']], 'delay':max([MIN_DELAY]+[g['delay'] for g in selected])}

def allowed(policy, url):
    u=urlsplit(url); path=u.path+('?' + u.query if u.query else '')
    matches=[]
    for value,allow in policy['rules']:
        end=value.endswith('$'); value=value[:-1] if end else value
        regex='^'+'.*'.join(re.escape(s) for s in value.split('*'))+('$' if end else '')
        if re.search(regex,path): matches.append((len(value.replace('*','')),allow))
    return not matches or max(matches)[1]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None

class Reader:
    def __init__(self, state_path, delay=MIN_DELAY):
        self.path=Path(state_path); self.delay=max(MIN_DELAY,delay); self.cache={}; self.denied={}; self.last=0
        try: self.state=json.loads(self.path.read_text())
        except (FileNotFoundError,ValueError): self.state={}
        self.opener=urllib.request.build_opener(NoRedirect)
        self.log_path=self.path.with_suffix('.jsonl')
    def save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,indent=2)+'\n')
    def request(self,url,delay=None,robot=False):
        u=urlsplit(url)
        if u.scheme not in ('http','https') or u.username or u.password: raise SourceBlocked('unsupported-url')
        origin=u.scheme+'://'+u.netloc; s=self.state.setdefault(origin,{'errors':0})
        now=datetime.now(timezone.utc)
        if s.get('blockedUntil') and datetime.fromisoformat(s['blockedUntil'])>now: raise SourceBlocked('host-stopped-for-24h')
        wait=max(self.delay,delay or 0)-(time.monotonic()-self.last)
        if wait>0: time.sleep(wait)
        self.last=time.monotonic(); stamp=datetime.now(timezone.utc).isoformat()
        req=urllib.request.Request(url,headers={'User-Agent':UA})
        try:
            try: response=self.opener.open(req,timeout=35)
            except urllib.error.HTTPError as e: response=e
            with response: status=response.code; headers=dict(response.headers); body=response.read(32*1024*1024+1)
            if len(body)>32*1024*1024: raise SourceBlocked('document-exceeds-32MiB')
            # 404 is a documented absence, not a server error.
            failed=status>=400 and status not in (404,410)
            s['errors']=s.get('errors',0)+1 if failed else 0
            self.log_path.parent.mkdir(parents=True,exist_ok=True)
            with self.log_path.open('a') as f: f.write(json.dumps({'at':stamp,'url':url,'status':status,'robots':robot})+'\n')
            return status,headers,body
        except (urllib.error.URLError,TimeoutError,OSError):
            s['errors']=s.get('errors',0)+1
            raise
        finally:
            if s.get('errors',0)>=5: s['blockedUntil']=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
            self.save()
    def policy(self,url):
        u=urlsplit(url); origin=u.scheme+'://'+u.netloc
        if origin in self.denied:
            raise SourceBlocked(self.denied[origin])
        try:
            return self._policy(url)
        except SourceBlocked as e:
            self.denied[origin]=str(e)
            raise
    def _policy(self,url):
        u=urlsplit(url); origin=u.scheme+'://'+u.netloc
        if origin not in self.cache:
            current=origin+'/robots.txt'
            for _ in range(5):
                status,headers,body=self.request(current,robot=True)
                location=next((v for k,v in headers.items() if k.lower()=='location'),None)
                if 300<=status<400 and location:
                    current=urljoin(current,location)
                    if urlsplit(current).path!='/robots.txt': raise SourceBlocked('robots-redirect-to-non-robots')
                    continue
                if status in (404,410): policy=robot_rules('')
                elif status==200 and not re.search(rb'<html\b',body[:1000],re.I): policy=robot_rules(body.decode('utf8','replace'))
                else: raise SourceBlocked('robots-unavailable-'+str(status))
                self.cache[origin]=policy; break
            else: raise SourceBlocked('robots-redirect-limit')
        return self.cache[origin]
    def get(self,url):
        for _ in range(6):
            policy=self.policy(url)
            if not allowed(policy,url): raise SourceBlocked('robots-disallowed')
            status,headers,body=self.request(url,delay=policy['delay'])
            location=next((v for k,v in headers.items() if k.lower()=='location'),None)
            if 300<=status<400 and location: url=urljoin(url,location); continue
            if status!=200: raise SourceBlocked('http-'+str(status))
            if re.search(rb'cf-chl-|verify you are human|<title[^>]*>\s*(?:access denied|just a moment)',body[:100000],re.I): raise SourceBlocked('access-wall')
            return url,headers,body
        raise SourceBlocked('redirect-limit')
