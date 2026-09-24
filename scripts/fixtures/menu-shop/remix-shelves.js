/* Two pages of one shelf, shared by the two paged server-rendered fixtures. */
window.__shelfPages = {
  1: [
    { id: 'p1', brandName: 'Good Green', Name: 'Good Green - Creamsicle Sunset - 3.5g', type: 'Flower',
      strainType: 'Hybrid', THC: { range: [25.95, 25.95], unit: 'PERCENTAGE' }, Options: ['1/8oz'], Prices: [32] },
    { id: 'p2', brandName: 'Nanticoke', Name: 'Nanticoke - Sour Diesel - 3.5g', type: 'Flower',
      strainType: 'Sativa', THC: { range: [26.2, 26.2], unit: 'PERCENTAGE' }, Options: ['1/8oz'], Prices: [45] },
  ],
  2: [
    { id: 'p3', brandName: 'Florist Farms', Name: 'Florist Farms - Maui Wowie - 3.5g', type: 'Flower',
      strainType: 'Sativa', THC: { range: [22.1, 22.1], unit: 'PERCENTAGE' }, Options: ['1/8oz'], Prices: [40] },
    { id: 'p4', brandName: 'Aeterna', Name: 'Aeterna - Blue Dream - 3.5g', type: 'Flower',
      strainType: 'Hybrid', THC: { range: [24.4, 24.4], unit: 'PERCENTAGE' }, Options: ['1/8oz'], Prices: [38] },
  ],
};
window.__render = (products) => {
  for (const p of products) {
    const li = document.createElement('li');
    li.textContent = p.Name + ' — $' + p.Prices[0];
    document.getElementById('menu').appendChild(li);
  }
};
