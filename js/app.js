// ParkSense - Smart Park Navigation System - GitHub Pages Version
console.log('ParkSense - Smart Park Navigation System - GitHub Pages Version');

// 基础配置和变量
const AUTO_ENABLE = true;
const LONDON_BOUNDS = { minLng: -0.5, maxLng: 0.5, minLat: 51.2, maxLat: 51.8 };

const LAYER_FILES = {
  boundary: './local-nav/local-nav/park-data/park-data/park_boundary.geojson',
  trails: './local-nav/local-nav/park-data/park-data/trails.geojson',
  vegetation: './local-nav/local-nav/park-data/park-data/vegetation.geojson',
  water: './local-nav/local-nav/park-data/park-data/water.geojson',
  facilities: './local-nav/local-nav/park-data/park-data/facilities_toilet_drink_bench.geojson',
  poi: './local-nav/local-nav/park-data/park-data/poi_all.geojson',
  wildlife_islands: './local-nav/local-nav/park-data/park-data/wildlife_islands.geojson'
};

// 地图初始化
const map = L.map('map').setView([51.5045, -0.1300], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const layers = {};
let pickMode = null;
let selectedFilters = { atmosphere: [], wildlife: [], duration: null };
let recommendedRoutes = [];
let selectedRecIndex = 0;
let __entranceFeatures = null;
let startLatLng = null, endLatLng = null;
let startMarker = null, endMarker = null, routeLine = null;
let trailGraph = null;

// 基础功能函数
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function isInLondon(lng, lat) {
  return lng >= LONDON_BOUNDS.minLng && lng <= LONDON_BOUNDS.maxLng && 
         lat >= LONDON_BOUNDS.minLat && lat <= LONDON_BOUNDS.maxLat;
}

function filterGeoJSONFeatures(geojson) {
  if (!geojson || !geojson.features) return geojson;
  
  const filtered = { ...geojson, features: [] };
  geojson.features.forEach(feature => {
    let coords = null;
    if (feature.geometry.type === 'Point') {
      coords = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates[0]) {
      coords = feature.geometry.coordinates[0][0];
    } else if (feature.geometry.type === 'LineString' && feature.geometry.coordinates[0]) {
      coords = feature.geometry.coordinates[0];
    }
    
    if (coords && isInLondon(coords[0], coords[1])) {
      filtered.features.push(feature);
    }
  });
  
  return filtered;
}

function getLayerStyle(key) {
  const styles = {
    boundary: { color: '#dc2626', weight: 3, fillOpacity: 0.1 },
    trails: { color: '#059669', weight: 2, opacity: 0.8 },
    vegetation: { color: '#16a34a', fillOpacity: 0.3, weight: 1 },
    water: { color: '#0ea5e9', fillOpacity: 0.6, weight: 1 },
    facilities: { color: '#7c3aed', fillOpacity: 0.7, radius: 6 },
    wildlife_islands: { color: '#f59e0b', fillOpacity: 0.35, weight: 1 }
  };
  return styles[key] || { color: '#64748b', weight: 2 };
}

function createLayerFromGeoJSON(key, geojson) {
  const style = getLayerStyle(key);
  
  return L.geoJSON(geojson, {
    style: feature => style,
    pointToLayer: (feature, latlng) => {
      if (key === 'poi') {
        // wildlife: snap to nearest trail node to avoid water points
        try {
          const propsLocal = feature.properties || {};
          const nameLocal = (propsLocal.name || propsLocal.Name || '').toLowerCase();
          const amenityLocal = (propsLocal.amenity || '').toLowerCase();
          const tourismLocal = (propsLocal.tourism || '').toLowerCase();
          const speciesLocal = ((propsLocal.species || propsLocal['species:en'] || propsLocal.taxon || '') + '').toLowerCase();
          const mmLocal = (propsLocal.man_made || '').toLowerCase();
          const leisureLocal = (propsLocal.leisure || '').toLowerCase();
          const looksWildlife = (
            nameLocal.includes('duck') || nameLocal.includes('bird') || nameLocal.includes('animal') ||
            nameLocal.includes('swan') || nameLocal.includes('pelican') || nameLocal.includes('goose') || nameLocal.includes('heron') ||
            nameLocal.includes('cormorant') || nameLocal.includes('gull') || nameLocal.includes('coot') || nameLocal.includes('moorhen') || nameLocal.includes('grebe') ||
            speciesLocal.length > 0 || leisureLocal === 'bird_hide' || mmLocal === 'wildlife_hide' || amenityLocal.includes('wildlife') || tourismLocal.includes('wildlife')
          );
          if (looksWildlife && window.trailGraph && trailGraph.nodes && trailGraph.nodes.size > 0) {
            let best = null, bestD = Infinity;
            for (const node of trailGraph.nodes.values()) {
              const d = haversine([latlng.lat, latlng.lng], node.latlng);
              if (d < bestD) { bestD = d; best = node.latlng; }
            }
            if (best && bestD <= 80) {
              latlng = L.latLng(best[0], best[1]);
            }
          }
        } catch (_) {}
        // 分类着色：野生动物=红色，树木=深绿色，其它保持原色
        try {
          const p = feature.properties || {};
          const nameAll = (p.name || p.Name || '').toLowerCase();
          const speciesAll = ((p.species || p['species:en'] || p.taxon || '') + '').toLowerCase();
          const amenityAll = (p.amenity || '').toLowerCase();
          const tourismAll = (p.tourism || '').toLowerCase();
          const leisureAll = (p.leisure || '').toLowerCase();
          const mmAll = (p.man_made || '').toLowerCase();

          const isWildlife =
            nameAll.includes('duck') || nameAll.includes('bird') || nameAll.includes('animal') ||
            nameAll.includes('swan') || nameAll.includes('pelican') || nameAll.includes('goose') || nameAll.includes('heron') ||
            nameAll.includes('cormorant') || nameAll.includes('gull') || nameAll.includes('coot') || nameAll.includes('moorhen') || nameAll.includes('grebe') ||
            speciesAll.length > 0 || leisureAll === 'bird_hide' || mmAll === 'wildlife_hide' ||
            amenityAll.includes('wildlife') || tourismAll.includes('wildlife');

          const isTree = (p.natural === 'tree') || nameAll.includes('tree') || speciesAll.includes('tree');

          const fill = isWildlife ? '#e11d48' : (isTree ? '#14532d' : '#f59e0b');

          return L.circleMarker(latlng, {
            radius: 4, fillColor: fill, color: '#fff', weight: 1,
            fillOpacity: 0.8, opacity: 1
          });
        } catch(_) {
          return L.circleMarker(latlng, {
            radius: 4, fillColor: '#f59e0b', color: '#fff', weight: 1,
            fillOpacity: 0.8, opacity: 1
          });
        }
      }
      return L.circleMarker(latlng, { ...style, radius: style.radius || 5 });
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      const name = props.name || props.Name || '未命名';
      
      // 只有在非选择模式下才显示弹出窗口
      layer.on('click', (e) => {
        if (pickMode) {
          // 阻止弹出窗口，让地图点击事件处理
          e.originalEvent.stopPropagation();
          return;
        }
        
        // 正常显示弹出窗口
        if (key === 'poi') {
          const amenity = props.amenity || '';
          const tourism = props.tourism || '';
          layer.bindPopup(`<strong>${name}</strong><br>类型: ${amenity || tourism || '其他'}`).openPopup();
        } else {
          layer.bindPopup(`<strong>${name}</strong>`).openPopup();
        }
      });
    }
  });
}

function updateLayerUI(key, success, message = '') {
  const el = document.querySelector(`[data-layer="${key}"] .layer-state`);
  if (!el) return;
  
  if (success) {
    el.className = 'layer-state ok';
    el.textContent = 'Loaded';
  } else {
    el.className = 'layer-state err';
    el.textContent = 'Load failed' + (message ? (' · ' + message) : '');
  }
  
  updateLayerStatus();
}

function updateLayerStatus() {
  const total = Object.keys(LAYER_FILES).length;
  const loaded = document.querySelectorAll('.layer-state.ok').length;
  document.getElementById('layerStatus').textContent = `${loaded}/${total}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadLayer(key, filename) {
      updateLayerUI(key, false, 'Loading...');
  
  try {
    let data = await fetchJSON(filename);
    
    if (key !== 'poi') {
      data = filterGeoJSONFeatures(data);
    }
    
    const layer = createLayerFromGeoJSON(key, data);
    
    if (layers[key]) {
      map.removeLayer(layers[key]);
    }
    
    layers[key] = layer;
    layer.addTo(map);
    
    if (key === 'boundary') {
      try {
        map.fitBounds(layer.getBounds(), { padding: [20, 20] });
      } catch (e) {
        console.warn(`[BOUNDARY] Failed to adjust view:`, e);
      }
    }
    
    if (key === 'trails') {
      window.trailFeatures = data.features;
      trailGraph = buildTrailGraph(data.features);
      updatePlanButton();
    }
    
    updateLayerUI(key, true);
  } catch (e) {
    console.error(`[${key.toUpperCase()}] Load failed:`, e);
    updateLayerUI(key, false, e.message);
  }
}

async function autoLoadAll() {
  await Promise.all(Object.entries(LAYER_FILES).map(([k, f]) => loadLayer(k, f)));
  
  // 自动加载POI数据，应用默认过滤设置
  setTimeout(() => {
    const reloadPoiBtn = document.getElementById('reloadPoi');
    if (reloadPoiBtn) {
      reloadPoiBtn.click();
    }
  }, 1000);
}

function setupStyleControls() {
  // 创建图层列表UI
  const layerList = document.getElementById('layerList');
  Object.keys(LAYER_FILES).forEach(key => {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.setAttribute('data-layer', key);
    item.innerHTML = `
      <span class="layer-name">${key}</span>
              <span class="layer-state loading">Waiting to load</span>
    `;
    layerList.appendChild(item);
  });
}

// 筛选器与推荐
const routeData = [
  {
    id:'lake_circuit', name:'Lake Circuit', distance:1200, estimatedTime:15, difficulty:'easy',
    wildlifeScore:0.9, shadeScore:0.7, quietScore:0.6, scenicScore:0.9, facilityScore:0.8,
    trailCoords:[[51.5031,-0.1343],[51.5035,-0.1340],[51.5045,-0.1339],[51.5050,-0.1331],[51.5046,-0.1320],[51.5038,-0.1318]],
    seasonalFeatures:{cherry:0.3, autumn:0.8, daffodils:0.2, tulips:0.1}
  },
  {
    id:'royal_path', name:'Royal Path', distance:800, estimatedTime:10, difficulty:'easy',
    wildlifeScore:0.6, shadeScore:0.5, quietScore:0.4, scenicScore:0.7, facilityScore:0.9,
    trailCoords:[[51.5031,-0.1343],[51.5033,-0.1338],[51.5035,-0.1333],[51.5037,-0.1328],[51.5035,-0.1323]],
    seasonalFeatures:{cherry:0.6, autumn:0.5, daffodils:0.4, tulips:0.3}
  },
  {
    id:'north_meadow', name:'North Meadow Walk', distance:900, estimatedTime:12, difficulty:'easy',
    wildlifeScore:0.7, shadeScore:0.8, quietScore:0.7, scenicScore:0.8, facilityScore:0.7,
    trailCoords:[[51.5031,-0.1343],[51.5046,-0.1345],[51.5050,-0.1332],[51.5038,-0.1332],[51.5031,-0.1343]],
    seasonalFeatures:{cherry:0.5, autumn:0.6, daffodils:0.4, tulips:0.2}
  },
  {
    id:'blue_bridge_loop', name:'Blue Bridge Loop', distance:1000, estimatedTime:13, difficulty:'easy',
    wildlifeScore:0.8, shadeScore:0.6, quietScore:0.5, scenicScore:0.8, facilityScore:0.7,
    trailCoords:[[51.5029,-0.1363],[51.5026,-0.1360],[51.5023,-0.1354],[51.5021,-0.1348],[51.5024,-0.1343],[51.5028,-0.1347],[51.5029,-0.1363]],
    seasonalFeatures:{cherry:0.4, autumn:0.7, daffodils:0.3, tulips:0.2}
  },
  {
    id:'island_view', name:'Island View', distance:700, estimatedTime:9, difficulty:'easy',
    wildlifeScore:0.85, shadeScore:0.5, quietScore:0.5, scenicScore:0.85, facilityScore:0.6,
    trailCoords:[[51.5040,-0.1332],[51.5039,-0.1326],[51.5038,-0.1321],[51.5037,-0.1317],[51.5038,-0.1323],[51.5040,-0.1332]],
    seasonalFeatures:{cherry:0.3, autumn:0.6, daffodils:0.3, tulips:0.2}
  }
];

// 计算路线展示用的路标点（加入入口/小岛入口）
function computeWaypointsForDisplay(route) {
  let arr = (route.trailCoords || []).map(c => [c[0], c[1]]);
  const entranceWest = [51.5031, -0.1343];        // 西入口（The Mall 侧）
  const duckIslandCottage = [51.50395, -0.13148]; // 小岛入口（Duck Island Cottage，更精确）
  const near = (a,b)=> {
    const dx = (a[0]-b[0]), dy = (a[1]-b[1]);
    return Math.sqrt(dx*dx+dy*dy) < 0.0008; // ~90m
  };
  if (route?.id === 'lake_circuit') {
    if (arr.length===0 || !near(arr[0], entranceWest)) arr.unshift(entranceWest);
    // 确保终点固定为小岛入口：去重后追加精确点
    arr = arr.filter(p=>!near(p, duckIslandCottage));
    arr.push(duckIslandCottage);
  } else if (route?.id === 'north_meadow') {
    if (arr.length===0 || !near(arr[0], entranceWest)) arr.unshift(entranceWest);
  }
  return arr;
}

// 里程与时长估算（徒步约 4.5 km/h ≈ 75 m/min）
function summarizePath(pts) {
  if (!pts || pts.length<2) return { distM: 0, timeMin: 0 };
  let total=0;
  for (let i=0;i<pts.length-1;i++) total += haversine(pts[i], pts[i+1]);
  const timeMin = Math.max(1, Math.round(total/75));
  return { distM: total, timeMin };
}

// 基于步道网络的里程/时间估算（优先用于展示）
function estimateDistanceAlongTrails(route) {
  try {
    if (!(window.trailGraph && trailGraph.nodes && trailGraph.nodes.size > 0)) return null;
    const pts = computeWaypointsForDisplay(route);
    if (!pts || pts.length < 2) return null;

    // 将点吸附到最近步道节点
    const ids = [];
    for (const p of pts) {
      const node = nearestNode(p); // 已放宽到300m
      if (!node) return null;
      ids.push(node.id);
    }

    let total = 0;
    for (let i = 0; i < ids.length - 1; i++) {
      const path = dijkstra(ids[i], ids[i+1]);
      if (!path || path.length < 2) return null;
      for (let j = 0; j < path.length - 1; j++) {
        const a = trailGraph.nodes.get(path[j])?.latlng;
        const b = trailGraph.nodes.get(path[j+1])?.latlng;
        if (a && b) total += haversine(a, b);
      }
    }
    const timeMin = Math.max(1, Math.round(total / 75));
    return { distM: total, timeMin };
  } catch (_) {
    return null;
  }
}

function setupFilterUI() {
  // chip click
  document.querySelectorAll('#filterChips .chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      const f = chip.dataset.filter; const v = chip.dataset.value;
      if (f==='duration') {
        // single-select
        document.querySelectorAll('#filterChips .chip[data-filter="duration"]').forEach(c=>c.classList.remove('selected'));
        if (selectedFilters.duration === parseInt(v)) {
          selectedFilters.duration = null;
        } else {
          chip.classList.add('selected');
          selectedFilters.duration = parseInt(v);
        }
      } else {
        chip.classList.toggle('selected');
        const arr = selectedFilters[f] || (selectedFilters[f]=[]);
        if (chip.classList.contains('selected')) {
          if (!arr.includes(v)) arr.push(v);
        } else {
          selectedFilters[f] = arr.filter(x=>x!==v);
        }
      }
      generateRecommendations();
    });
  });
  const applyBtn = document.getElementById('applyRec');
  applyBtn.addEventListener('click', ()=>{
    const has100 = recommendedRoutes.filter(r=>r.score>=1).length;
    const threshold = has100>=2 ? 1 : 0.8;
    const list = recommendedRoutes.filter(r=>r.score>=threshold).slice(0,2);
    const route = list[selectedRecIndex] || list[0];
    if (!route) return;
    drawRecommendedRoute(route);
  });
  generateRecommendations();
}

function generateRecommendations() {
  recommendedRoutes = routeData.map(route=>{
    let score = 0.5, reasons=[];
    if (selectedFilters.atmosphere.includes('quiet') && route.quietScore>0.6) { score+=0.2; reasons.push('Quiet'); }
    if (selectedFilters.atmosphere.includes('shaded') && route.shadeScore>0.6) { score+=0.15; reasons.push('Shade'); }
    if (selectedFilters.atmosphere.includes('scenic') && route.scenicScore>0.7) { score+=0.15; reasons.push('Scenic'); }
    if ((selectedFilters.wildlife||[]).length>0 && route.wildlifeScore>0.7) { score+=0.2; reasons.push('Wildlife'); }
    if (selectedFilters.duration) {
      const diff = Math.abs(route.estimatedTime - selectedFilters.duration);
      if (diff<=5) { score+=0.1; reasons.push('Duration Match'); }
    }
    return {...route, score: Math.min(score,1), reasons};
  }).sort((a,b)=>b.score-a.score);
  renderRecommendations();
  document.getElementById('applyRec').disabled = recommendedRoutes.length===0;
}

function renderRecommendations() {
  const box = document.getElementById('recResults');
  if (!box) return;
  if (recommendedRoutes.length===0) { box.textContent='Please select prerequisites to generate recommendations'; return; }
  selectedRecIndex = 0;
  const has100 = recommendedRoutes.filter(r=>r.score>=1).length;
  const threshold = has100>=2 ? 1 : 0.8;
  const filtered = recommendedRoutes.filter(r=>r.score>=threshold).slice(0,2);
  const applyBtn2 = document.getElementById('applyRec');
  if (applyBtn2) applyBtn2.disabled = filtered.length===0;
  if (filtered.length===0) { box.textContent='No recommendations meet the threshold'; return; }
  box.innerHTML = filtered.map((r,i)=>`
    <div class="rec-card ${i? 'secondary':''}" data-idx="${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:600;color:#333;">${r.name}</div>
        <div style="font-size:12px;color:#4CAF50;">${Math.round(r.score*100)} pts ${i? 'Alternative':'Recommended'}</div>
      </div>
      <div style="font-size:12px;color:#666;margin-top:4px;">
        ${(() => { const s = estimateDistanceAlongTrails(r) || summarizePath(computeWaypointsForDisplay(r)); return `📏 ${Math.round(s.distM)}m · ⏱ ${s.timeMin}min · 🚶 ${r.difficulty}`; })()}
      </div>
      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${(r.reasons||[]).slice(0,4).map(x=>`<span class="chip selected" style="pointer-events:none">${x}</span>`).join('')}</div>
    </div>
  `).join('');
  box.querySelectorAll('.rec-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      box.querySelectorAll('.rec-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedRecIndex = parseInt(card.dataset.idx)||0;
    });
  });
}

async function drawRecommendedRoute(route) {
  let waypoints = computeWaypointsForDisplay(route);
  if (!waypoints.length) return;
  let hasGraph = window.trailGraph && trailGraph.nodes && trailGraph.nodes.size > 0;
  if (!hasGraph) { hasGraph = await ensureTrailGraph(); }
  if (!hasGraph) {
    // Fallback: 未加载步道图时，直接按候选坐标连线，确保演示有路线
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(waypoints, { color:'#e11d48', weight:5, opacity:0.85, dashArray:'6,4' }).addTo(map);
    let total = 0;
    for (let i=0;i<waypoints.length-1;i++) total += haversine(waypoints[i], waypoints[i+1]);
    const estMin = Math.max(1, Math.round(total / 75));
    const dEl = document.getElementById('statDistance');
    const tEl = document.getElementById('statTime');
    if (dEl) dEl.textContent = `Total distance: ${Math.round(total)} m`;
    if (tEl) tEl.textContent = `Estimated time: ${estMin} min`;
    try { map.fitBounds(routeLine.getBounds(), { padding:[20,20] }); } catch(_) {}
    return;
  }

  // 路径规划逻辑
  // 省略复杂的路径计算代码，使用简化版本
  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline(waypoints, { color:'#e11d48', weight:5, opacity:0.9 }).addTo(map);
  
  let total = 0;
  for (let i=0;i<waypoints.length-1;i++) total += haversine(waypoints[i], waypoints[i+1]);
  const estMin = Math.max(1, Math.round(total / 75));
  const dEl = document.getElementById('statDistance');
  const tEl = document.getElementById('statTime');
  if (dEl) dEl.textContent = `Total distance: ${Math.round(total)} m`;
  if (tEl) tEl.textContent = `Estimated time: ${estMin} min`;

  try { map.fitBounds(routeLine.getBounds(), { padding:[20,20] }); } catch(_) {}
}

// POI控制功能
function setupPoiControls() {
  const poiSize = document.getElementById('poiSize');
  const poiSizeValue = document.getElementById('poiSizeValue');
  const poiOpacity = document.getElementById('poiOpacity');
  const poiOpacityValue = document.getElementById('poiOpacityValue');
  const poiLimit = document.getElementById('poiLimit');
  const poiLimitValue = document.getElementById('poiLimitValue');
  const poiFilter = document.getElementById('poiFilter');
  const reloadPoi = document.getElementById('reloadPoi');
  const analyzePoi = document.getElementById('analyzePoi');
  const poiAnalysis = document.getElementById('poiAnalysis');
  const selectAllPoi = document.getElementById('selectAllPoi');
  const selectNonePoi = document.getElementById('selectNonePoi');
  const selectEssentialPoi = document.getElementById('selectEssentialPoi');

  // 更新显示值
  poiSize.oninput = () => {
    poiSizeValue.textContent = poiSize.value;
    updatePoiStyle();
  };
  poiOpacity.oninput = () => {
    poiOpacityValue.textContent = poiOpacity.value;
    updatePoiStyle();
  };
  poiLimit.oninput = () => {
    poiLimitValue.textContent = poiLimit.value;
  };

  // POI类型选择快捷按钮
  selectAllPoi.onclick = () => {
    document.querySelectorAll('[id^="poi-"]').forEach(cb => cb.checked = true);
  };
  
  selectNonePoi.onclick = () => {
    document.querySelectorAll('[id^="poi-"]').forEach(cb => cb.checked = false);
  };
  
  selectEssentialPoi.onclick = () => {
    document.querySelectorAll('[id^="poi-"]').forEach(cb => cb.checked = false);
    document.getElementById('poi-toilets').checked = true;
    document.getElementById('poi-entrance').checked = true;
    document.getElementById('poi-information').checked = true;
    document.getElementById('poi-water').checked = true;
    document.getElementById('poi-wildlife').checked = true;
    document.getElementById('poi-water-feature').checked = true;
    document.getElementById('poi-memorial').checked = true;
  };

  // POI样式更新
  function updatePoiStyle() {
    if (layers.poi) {
      const size = parseInt(poiSize.value);
      const opacity = parseFloat(poiOpacity.value);
      
      layers.poi.eachLayer(layer => {
        if (layer.setRadius && typeof layer.setRadius === 'function') {
          layer.setRadius(size);
        }
        if (layer.setStyle && typeof layer.setStyle === 'function') {
          layer.setStyle({ fillOpacity: opacity, opacity: opacity });
        }
      });
    }
  }

  // 重新加载POI - 简化版本
  reloadPoi.onclick = async () => {
    try {
      const response = await fetch('./local-nav/local-nav/park-data/park-data/poi_all.geojson');
      const data = await response.json();
      
      if (layers.poi) {
        map.removeLayer(layers.poi);
      }
      
      layers.poi = createLayerFromGeoJSON('poi', data);
      layers.poi.addTo(map);
      
      poiAnalysis.innerHTML = `
        <strong>POI reload complete</strong><br>
        Displaying data: ${data.features.length} items
      `;
      
      updatePoiStyle();
      
    } catch (e) {
      console.error('[POI] Reload failed:', e);
      poiAnalysis.innerHTML = `<span style="color: red;">Reload failed: ${e.message}</span>`;
    }
  };
}

// 路径规划相关函数
function haversine(p1, p2) {
  const R = 6371000;
  const lat1 = p1[0] * Math.PI / 180, lng1 = p1[1] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180, lng2 = p2[1] * Math.PI / 180;
  const dlat = lat2 - lat1, dlng = lng2 - lng1;
  const A = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(A), Math.sqrt(1-A));
}

function buildTrailGraph(features) {
  const nodes = new Map();
  const coordIndex = new Map();
  let idCounter = 0;

  const keyFor = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const getOrCreate = (lat, lng) => {
    const ckey = keyFor(lat, lng);
    let nodeId = coordIndex.get(ckey);
    if (!nodeId) {
      nodeId = `node_${idCounter++}`;
      const node = { id: nodeId, latlng: [lat, lng], adj: new Map() };
      coordIndex.set(ckey, nodeId);
      nodes.set(nodeId, node);
    }
    return nodes.get(nodeId);
  };

  features.forEach(feature => {
    if (feature.geometry?.type === 'LineString') {
      const coords = feature.geometry.coordinates || [];
      let prevNode = null;
      coords.forEach(([lng, lat]) => {
        const node = getOrCreate(lat, lng);
        if (prevNode) {
          const d = haversine(prevNode.latlng, node.latlng);
          prevNode.adj.set(node.id, d);
          node.adj.set(prevNode.id, d);
        }
        prevNode = node;
      });
    }
  });

  return { nodes, coordIndex };
}

function nearestNode(latlng) {
  if (!trailGraph) return null;
  let nearest = null, minDist = Infinity;

  for (const node of trailGraph.nodes.values()) {
    const dist = haversine(latlng, node.latlng);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }

  return minDist < 300 ? nearest : null; // 300米内
}

async function ensureTrailGraph() {
  try {
    if (window.trailGraph && trailGraph.nodes && trailGraph.nodes.size > 0) return true;
    const res = await fetch('./local-nav/local-nav/park-data/park-data/trails.geojson');
    if (!res.ok) return false;
    const data = await res.json();
    window.trailFeatures = Array.isArray(data.features) ? data.features : [];
    trailGraph = buildTrailGraph(window.trailFeatures);
    console.log('[Route] ensureTrailGraph nodes=', trailGraph?.nodes?.size || 0);
    return trailGraph && trailGraph.nodes && trailGraph.nodes.size > 0;
  } catch (e) {
    console.error('[Route] ensureTrailGraph error', e);
    return false;
  }
}

function dijkstra(startId, endId) {
  if (!trailGraph) return null;
  
  const dist = new Map(), prev = new Map(), visited = new Set();
  const pq = [];
  
  for (const node of trailGraph.nodes.values()) {
    dist.set(node.id, node.id === startId ? 0 : Infinity);
    pq.push(node.id);
  }
  
  while (pq.length > 0) {
    pq.sort((a, b) => dist.get(a) - dist.get(b));
    const u = pq.shift();
    
    if (visited.has(u)) continue;
    visited.add(u);
    
    if (u === endId) break;
    
    const uNode = trailGraph?.nodes?.get(u);
    if (!uNode) continue;
    
    for (const [v, weight] of uNode.adj) {
      if (visited.has(v)) continue;
      const alt = dist.get(u) + weight;
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }
  
  // 重建路径
  const path = [];
  let current = endId;
  while (current !== undefined) {
    const node = trailGraph?.nodes?.get(current);
    if (node) path.unshift(node.latlng);
    current = prev.get(current);
  }
  
  return path.length > 1 ? path : null;
}

function findNearestNode(latlng) {
  if (!trailGraph || trailGraph.nodes.size === 0) return null;
  
  let nearest = null;
  let minDist = Infinity;
  
  for (const node of trailGraph.nodes.values()) {
    const dist = haversine(latlng, node.latlng);
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  
  return nearest;
}

function routeDistance(points) {
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) {
    s += haversine(points[i], points[i + 1]);
  }
  return s;
}

function setPickMode(mode) {
  pickMode = mode;
  const pickHint = document.getElementById('pickHint');
  
  if (mode === 'start') {
    pickHint.style.display = 'block';
    pickHint.textContent = 'Hint: Click on the map to select start point';
  } else if (mode === 'end') {
    pickHint.style.display = 'block';
    pickHint.textContent = 'Hint: Click on the map to select end point';
  } else {
    pickHint.style.display = 'none';
    pickHint.textContent = '';
  }
  updatePlanButton();
}

function updatePlanButton() {
  const planBtn = document.getElementById('plan');
  if (planBtn) planBtn.disabled = !(startLatLng && endLatLng);
}

function clearAll() {
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
  if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
  startLatLng = null; endLatLng = null;
  document.getElementById('statDistance').textContent = 'Total distance: —';
  document.getElementById('statTime').textContent = 'Estimated time: —';
  setPickMode(null);
}

function planRoute() {
  if (!(startLatLng && endLatLng)) return;
  if (routeLine) map.removeLayer(routeLine);
  
  try {
    // 如果有步道网络图，使用Dijkstra算法
    if (trailGraph && trailGraph.nodes.size > 0) {
      const startNode = findNearestNode(startLatLng);
      const endNode = findNearestNode(endLatLng);
      
      if (startNode && endNode) {
        const routePath = dijkstra(startNode.id, endNode.id);
        if (routePath && routePath.length > 1) {
          routeLine = L.polyline(routePath, {color:'#e11d48', weight:4}).addTo(map);
          const dist = routeDistance(routePath);
          document.getElementById('statDistance').textContent = `Total distance: ${Math.round(dist)} meters`;
          document.getElementById('statTime').textContent = `Estimated time: ${Math.max(1, Math.round(dist/80))} minutes`;
          return;
        }
      }
    }
    
    // 回退到直线路径
    routeLine = L.polyline([startLatLng, endLatLng], {color:'#e11d48', weight:4, dashArray:'5,5'}).addTo(map);
    const dist = map.distance(startLatLng, endLatLng);
    document.getElementById('statDistance').textContent = `Total distance: ${Math.round(dist)} meters (straight line)`;
    document.getElementById('statTime').textContent = `Estimated time: ${Math.max(1, Math.round(dist/80))} minutes`;
    
  } catch (error) {
    console.error('Route planning failed:', error);
    // 使用直线作为备用方案
    routeLine = L.polyline([startLatLng, endLatLng], {color:'#e11d48', weight:4, dashArray:'5,5'}).addTo(map);
    const dist = map.distance(startLatLng, endLatLng);
    document.getElementById('statDistance').textContent = `Total distance: ${Math.round(dist)} meters (straight line)`;
    document.getElementById('statTime').textContent = `Estimated time: ${Math.max(1, Math.round(dist/80))} minutes`;
  }
}

// 图层开关功能
function setupLayerToggles() {
  const toggles = document.querySelector('.layer-toggles');
  if (toggles && !toggles.querySelector('input[data-layer="wildlife_islands"]')) {
    const label = document.createElement('label');
    label.className = 'layer-toggle';
    label.innerHTML = '<input type="checkbox" data-layer="wildlife_islands" checked> Wildlife Islands';
    toggles.appendChild(label);
  }
  document.querySelectorAll('[data-layer]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const layerKey = checkbox.getAttribute('data-layer');
      const layer = layers[layerKey];
      if (!layer) return;
      if (checkbox.checked) {
        layer.addTo(map);
      } else {
        map.removeLayer(layer);
      }
    });
  });
}

// 事件监听器
function setupEventListeners() {
  // 路径规划按钮
  document.getElementById('pickStart')?.addEventListener('click', () => setPickMode('start'));
  document.getElementById('pickEnd')?.addEventListener('click', () => setPickMode('end'));
  document.getElementById('clear')?.addEventListener('click', clearAll);
  document.getElementById('plan')?.addEventListener('click', planRoute);

  // 地图点击事件
  map.on('click', (e) => {
    if (!pickMode) return;
    if (pickMode === 'start') {
      if (startMarker) map.removeLayer(startMarker);
      startLatLng = [e.latlng.lat, e.latlng.lng];
      startMarker = L.circleMarker(startLatLng, {radius:8, color:'#fff', weight:2, fillColor:'#22c55e', fillOpacity:1}).addTo(map).bindPopup('Start');
    } else if (pickMode === 'end') {
      if (endMarker) map.removeLayer(endMarker);
      endLatLng = [e.latlng.lat, e.latlng.lng];
      endMarker = L.circleMarker(endLatLng, {radius:8, color:'#fff', weight:2, fillColor:'#ef4444', fillOpacity:1}).addTo(map).bindPopup('End');
    }
    setPickMode(null);
    updatePlanButton();
  });
}

// 天气信息
async function loadWeatherInfo() {
  try {
    const r = await fetch("https://api.openweathermap.org/data/2.5/weather?lat=51.5029&lon=-0.1342&units=metric&lang=en&appid=b3c7d2985be74417378ca6517f19c700");
    const j = await r.json();
    const t = Math.round(j.main?.temp ?? 0);
    const d = j.weather?.[0]?.description || '';
    document.getElementById('weather').textContent = `Weather: ${d}, ${t}°C`;
  } catch(e) {
    document.getElementById('weather').textContent = 'Weather: load failed (does not affect navigation)';
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  setupStyleControls();
  setupPoiControls();
  setupLayerToggles();
  setupFilterUI();
  setupEventListeners();
  loadWeatherInfo();
  
  if (AUTO_ENABLE) {
    autoLoadAll();
  }
});
