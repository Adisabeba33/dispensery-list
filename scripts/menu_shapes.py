"""Where a menu payload keeps its products.

Both the probe and the collector need this, and they needed it separately
three times: `data` was missing from the collector's descent until September,
`objects` from both until a run on 2026-09-11 reported
dict(keys=meta,objects). Two copies of a list that keeps being wrong is two
places to forget, so the search lives here and the answer arrives in both.
"""


# Keys a wrapper is likely to hide the array behind, best first. This list has
# been wrong three times: `data` was missing until the collector found it,
# `objects` until a run reported dict(keys=meta,objects). Each miss cost a
# round trip to a network this session cannot reach, so the list is now a
# preference, not a requirement — see below.
PRODUCT_LIST_KEYS = ("objects", "data", "products", "items", "edges", "results", "nodes")


def descend_to_product_list(value, key: str, depth: int = 4) -> tuple[list | None, str]:
    """Finds the product array inside whatever wrapper the engine uses.

    Returns the array — empty or not — and the path we reached it by, so the
    report names the route instead of leaving the next reader to guess it. An
    array that is present and empty is the finding that says a menu really is
    assembled in the browser; it must not come back looking like "not found".

    Naming every wrapper key in advance is a game we keep losing: `data` was
    missing until the collector found it, `objects` until a run reported
    dict(keys=meta,objects), and each miss cost a round trip to a network this
    session cannot reach. So the known names are only a preference. Failing
    them, any list of objects will do, and failing that we walk into the
    dicts — a probe exists to discover what a site does, not to require that
    it match a list we wrote first.
    """
    if depth <= 0 or not isinstance(value, (dict, list)):
        return None, key
    if isinstance(value, list):
        return (value if not value or isinstance(value[0], dict) else None), key

    for candidate in PRODUCT_LIST_KEYS:
        if candidate in value:
            return descend_to_product_list(value[candidate], f"{key}.{candidate}", depth - 1)

    for k, v in sorted(value.items()):
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v, f"{key}.{k}"

    for k, v in sorted(value.items()):
        if isinstance(v, dict):
            found, path = descend_to_product_list(v, f"{key}.{k}", depth - 1)
            if found is not None:
                return found, path

    return None, key


# What a payload calls the size of the whole result set, as opposed to the
# page it just handed us. Best first; a wrapper that uses two of these is
# rare, and taking the largest is the safer error — it over-reports how much
# is missing rather than under-reporting it.
TOTAL_KEYS = ("total_count", "totalCount", "total", "totalResults", "count", "found")


def declared_total(value, depth: int = 4) -> int | None:
    """The size the payload claims for the whole shelf, if it says.

    A page of twenty products from a shop that stocks a hundred and thirty
    is not that shop's shelf, and recording it as one is the quiet kind of
    wrong this register exists to avoid: nothing looks missing, the field is
    full, and the number is false. The pagination envelope usually states the
    real total; this finds it so the caller can say how much it did not see.
    """
    if depth <= 0:
        return None
    if isinstance(value, dict):
        for key in TOTAL_KEYS:
            if isinstance(value.get(key), int) and value[key] >= 0:
                return value[key]
        totals = [t for t in (declared_total(v, depth - 1) for v in value.values())
                  if t is not None]
        return max(totals) if totals else None
    if isinstance(value, list):
        totals = [t for t in (declared_total(v, depth - 1) for v in value[:3])
                  if t is not None]
        return max(totals) if totals else None
    return None
