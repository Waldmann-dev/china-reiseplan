(function(){
'use strict';
/* ================= Daten ================= */
var LM = [
  {id:'forbidden', de:'Verbotene Stadt', en:'Forbidden City', x:0,   z:-40,  r:30, ly:34},
  {id:'jingshan',  de:'Jingshan-Park',   en:'Jingshan Park',   x:0,   z:-100, r:22, ly:28},
  {id:'wall',      de:'Mutianyu · Mauer',en:'Mutianyu · Great Wall', x:0,   z:-150, r:34, ly:36},
  {id:'lama',      de:'Lama-Tempel',     en:'Lama Temple',     x:85,  z:-50,  r:20, ly:24},
  {id:'hutong',    de:'Shichahai Hutongs',en:'Shichahai Hutongs', x:-85,z:-35,  r:26, ly:22},
  {id:'heaven',    de:'Himmelstempel',   en:'Temple of Heaven',x:-80, z:50,   r:24, ly:28},
  {id:'summer',    de:'Sommerpalast',    en:'Summer Palace',   x:85,  z:60,   r:28, ly:26},
  {id:'qianmen',   de:'Qianmen & Wangfujing', en:'Qianmen & Wangfujing', x:0, z:66, r:22, ly:26}
];
var visited = {};
var colliders = []; // {x,z,r}
/* ================= Start ================= */
document.getElementById('btn-start').addEventListener('click', function(){
  if (typeof THREE === 'undefined') { alert('Three.js konnte nicht geladen werden (CDN).'); return; }
  document.getElementById('game-start').style.display = 'none';
  document.getElementById('hud').classList.add('on');
  init();
});
/* ================= Helpers ================= */
function lam(c){ return new THREE.MeshLambertMaterial({color:c}); }
var MAT = {
  wallRed: lam(0xb03a2e), wallRedD: lam(0x8a2b21),
  roofY: lam(0xe6a817), roofYd: lam(0xb57f0e),
  roofG: lam(0x7d848b), roofGd: lam(0x5f656b),
  roofB: lam(0x2c5f9e), roofBd: lam(0x1e4470),
  marble: lam(0xefe9d8), marbleD: lam(0xd9d2ba),
  wood: lam(0x8a5a2b), woodD: lam(0x5f3c1a),
  green: lam(0x7cab5e), greenD: lam(0x5d8f46),
  water: lam(0x6fb3d8), sand: lam(0xdccfa8),
  stone: lam(0x9aa0a6), stoneD: lam(0x7c8288),
  white: lam(0xf2ede0), dark: lam(0x3a3f45)
};
function box(w,h,d,mat){ var m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); m.position.y = h/2; return m; }
function cyl(rt,rb,h,mat,seg){ var m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||12), mat); m.position.y = h/2; return m; }
function at(mesh,x,y,z){ mesh.position.x=x; mesh.position.y=y; mesh.position.z=z; return mesh; }
/* Chinesisches Dach (stilisiert): Traufe + Pyramide + First */
function hipRoof(w,d,h,mat,matD){
  var g = new THREE.Group();
  var eave = new THREE.Mesh(new THREE.BoxGeometry(w*1.16, Math.max(0.35,h*0.18), d*1.16), matD||mat);
  eave.position.y = h*0.09; g.add(eave);
  var pyr = new THREE.Mesh(new THREE.ConeGeometry(1,1,4,1), mat);
  pyr.rotation.y = Math.PI/4; pyr.scale.set(w*0.78, h, d*0.78);
  pyr.position.y = h*0.18 + h/2; g.add(pyr);
  var ridge = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,w*0.4), h*0.14, Math.max(0.5,d*0.1)), matD||mat);
  ridge.position.y = h*0.18 + h + h*0.04; g.add(ridge);
  return g;
}
/* Halle: Marmorsockel + rote Wände + Tür + Dach */
function hall(w,d,wallH,roofH,wallMat,roofMat,roofMatD,platH){
  var g = new THREE.Group(); platH = platH||1.4;
  var p1 = box(w+3.4, platH*0.55, d+3.4, MAT.marble); p1.position.y = platH*0.275; g.add(p1);
  var p2 = box(w+1.8, platH*0.45, d+1.8, MAT.marbleD); p2.position.y = platH*0.775; g.add(p2);
  var walls = box(w, wallH, d, wallMat); walls.position.y = platH + wallH/2; g.add(walls);
  var door = new THREE.Mesh(new THREE.BoxGeometry(w*0.28, wallH*0.72, 0.4), MAT.woodD);
  door.position.set(0, platH + wallH*0.36, d/2+0.15); g.add(door);
  for (var s=-1;s<=1;s+=2){
    var win = new THREE.Mesh(new THREE.BoxGeometry(w*0.2, wallH*0.4, 0.3), MAT.woodD);
    win.position.set(s*w*0.32, platH + wallH*0.45, d/2+0.12); g.add(win);
  }
  var roof = hipRoof(w+2.6, d+2.6, roofH, roofMat, roofMatD);
  roof.position.y = platH + wallH; g.add(roof);
  return g;
}
function addCollider(x,z,r){ colliders.push({x:x,z:z,r:r}); }
function makeLabel(de,en){
  var c = document.createElement('canvas'); c.width=512; c.height=170;
  var x = c.getContext('2d');
  x.fillStyle='rgba(15,28,42,0.66)';
  x.beginPath();
  if (x.roundRect) x.roundRect(46,10,420,150,28); else x.rect(46,10,420,150);
  x.fill();
  x.textAlign='center'; x.fillStyle='#fff';
  x.font='bold 50px system-ui, sans-serif';
  x.fillText(de, 256, 76);
  x.font='36px system-ui, sans-serif'; x.fillStyle='#bcd6f5';
  x.fillText(en, 256, 126);
  var t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  var s = new THREE.Sprite(new THREE.SpriteMaterial({map:t, depthTest:false, transparent:true}));
  s.scale.set(24, 8, 1); s.renderOrder = 5;
  return s;
}
/* ================= Landmarks ================= */
function buildForbidden(){
  var g = new THREE.Group(), W=84, D=60, WH=7;
  var wn = box(W,WH,2,MAT.wallRed); at(wn,0,0,-D/2); g.add(wn);
  var ws = box(W,WH,2,MAT.wallRed); at(ws,0,0,D/2); g.add(ws);
  var we = box(2,WH,D,MAT.wallRed); at(we,W/2,0,0); g.add(we);
  var ww = box(2,WH,D,MAT.wallRed); at(ww,-W/2,0,0); g.add(ww);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){
    var t = hall(9,9,4,3.2,MAT.wallRed,MAT.roofY,MAT.roofYd,0.8);
    t.position.set(c[0]*W/2, WH, c[1]*D/2); g.add(t);
  });
  // Mittagstor (Süden)
  var gp = box(36,6,12,MAT.marble); at(gp,0,0,D/2); g.add(gp);
  var gh = hall(26,10,6,4.5,MAT.wallRed,MAT.roofY,MAT.roofYd,0); gh.position.set(0,6,D/2); g.add(gh);
  [-1,1].forEach(function(s){
    var wing = hall(9,15,5,3.6,MAT.wallRed,MAT.roofY,MAT.roofYd,0);
    wing.position.set(s*20,6,D/2+2); g.add(wing);
  });
  // Drei Große Hallen
  var h1 = hall(30,18,8,6,MAT.wallRed,MAT.roofY,MAT.roofYd,2.6); h1.position.set(0,0,-6); g.add(h1);
  var h2 = hall(24,14,7,5,MAT.wallRed,MAT.roofY,MAT.roofYd,2.2); h2.position.set(0,0,-25); g.add(h2);
  var h3 = hall(26,15,7,5,MAT.wallRed,MAT.roofY,MAT.roofYd,2.2); h3.position.set(0,0,-43); g.add(h3);
  // Seitenhallen
  [-28,28].forEach(function(x){ [-8,-25,-42].forEach(function(z){
    var sh = hall(12,10,5,3.4,MAT.wallRed,MAT.roofG,MAT.roofGd,1); sh.position.set(x,0,z); g.add(sh);
  });});
  g.position.set(0,0,-40);
  addCollider(0,-22,30); addCollider(0,-58,30);
  var l = makeLabel('Verbotene Stadt','Forbidden City'); l.position.set(0,36,-40); g.add(l);
  return g;
}
function buildJingshan(){
  var g = new THREE.Group();
  var hill = new THREE.Mesh(new THREE.ConeGeometry(20,15,14), MAT.green);
  hill.position.y = 7.5; g.add(hill);
  var pav = hall(10,10,5,4,MAT.wallRed,MAT.roofY,MAT.roofYd,1); pav.position.y = 14.5; g.add(pav);
  g.position.set(0,0,-100);
  addCollider(0,-100,21);
  var l = makeLabel('Jingshan-Park','Jingshan Park'); l.position.set(0,30,-100); g.add(l);
  return g;
}
function buildWall(){
  var g = new THREE.Group();
  for (var i=0;i<7;i++){
    var hx = -135 + i*45, hz = -152 + (i%2? 6 : -4);
    var hill = new THREE.Mesh(new THREE.ConeGeometry(30,22,10), i%2?MAT.green:MAT.greenD);
    hill.position.set(hx, 8, hz); g.add(hill);
  }
  // Mauersegmente entlang des Kamms
  for (var s=0;s<8;s++){
    var x0 = -140 + s*40, x1 = -100 + s*40;
    var mx=(x0+x1)/2, mz=-150+Math.sin(s*1.3)*7, my=17+Math.cos(s)*2;
    var len = Math.hypot(x1-x0, 8);
    var seg = new THREE.Mesh(new THREE.BoxGeometry(len,4.5,3.4), MAT.stone);
    seg.position.set(mx,my,mz); seg.rotation.y = Math.atan2(8, x1-x0)*0.3; g.add(seg);
    for (var k=0;k<7;k++){
      var cr = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,3.6), MAT.stoneD);
      cr.position.set(x0+4+k*((x1-x0-8)/6), my+2.8, mz); cr.rotation.y = seg.rotation.y; g.add(cr);
    }
  }
  [-70,10,80].forEach(function(x){
    var tw = new THREE.Mesh(new THREE.BoxGeometry(7,10,7), MAT.stone);
    tw.position.set(x, 20, -150+Math.sin(x)*4); g.add(tw);
    var r = hipRoof(9.5,9.5,3.4,MAT.roofG,MAT.roofGd); r.position.set(x, 25, -150+Math.sin(x)*4); g.add(r);
  });
  [-100,-40,20,80].forEach(function(x){ addCollider(x,-150,17); });
  var l = makeLabel('Mutianyu · Große Mauer','Mutianyu · Great Wall'); l.position.set(0,40,-150); g.add(l);
  return g;
}
function buildLama(){
  var g = new THREE.Group();
  // Paifang
  [-4,4].forEach(function(x){ var p = cyl(0.7,0.7,9,MAT.wallRed); p.position.set(x,0,14); g.add(p); });
  var pr = hipRoof(14,4,3,MAT.roofG,MAT.roofGd); pr.position.set(0,9,14); g.add(pr);
  var h1 = hall(17,11,6,4.2,MAT.wallRed,MAT.roofG,MAT.roofGd,1.4); h1.position.set(0,0,2); g.add(h1);
  var h2 = hall(13,10,5.5,4,MAT.wallRed,MAT.roofG,MAT.roofGd,1.4); h2.position.set(0,0,-12); g.add(h2);
  var burn = cyl(1.4,1.1,2.2,MAT.stoneD); burn.position.set(8,0,8); g.add(burn);
  var wl = box(44,3,1.2,MAT.wallRed); at(wl,0,0,20); g.add(wl);
  g.position.set(85,0,-50);
  addCollider(85,-48,19); addCollider(85,-62,12);
  var l = makeLabel('Lama-Tempel','Lama Temple'); l.position.set(85,26,-50); g.add(l);
  return g;
}
function buildHutong(){
  var g = new THREE.Group();
  var houses = [[-12,-8],[2,-8],[16,-6],[-12,8],[2,8],[16,10]];
  houses.forEach(function(h){
    var hs = new THREE.Group();
    var base = box(11,4,8,MAT.white); hs.add(base);
    var rf = hipRoof(12.5,9.5,3,MAT.roofG,MAT.roofGd); rf.position.y = 4; hs.add(rf);
    var dr = new THREE.Mesh(new THREE.BoxGeometry(2,3,0.4), MAT.woodD); dr.position.set(0,1.5,4.1); hs.add(dr);
    hs.position.set(h[0],0,h[1]); g.add(hs);
    addCollider(-85+h[0], -35+h[1], 8);
  });
  var lake = new THREE.Mesh(new THREE.PlaneGeometry(22,14), MAT.water);
  lake.rotation.x = -Math.PI/2; lake.position.set(-30,0.06,10); g.add(lake);
  g.position.set(-85,0,-35);
  var l = makeLabel('Shichahai · Hutongs','Shichahai · Hutongs'); l.position.set(-85,24,-35); g.add(l);
  return g;
}
function buildHeaven(){
  var g = new THREE.Group();
  var t1 = cyl(15,15,1.4,MAT.marble,24); t1.position.y=0; g.add(t1);
  var t2 = cyl(12,12,1.4,MAT.marble,24); t2.position.y=1.4; g.add(t2);
  var t3 = cyl(9,9,1.4,MAT.marbleD,24); t3.position.y=2.8; g.add(t3);
  var wall = cyl(6.4,6.4,5.5,MAT.wallRed,20); wall.position.y=4.2; g.add(wall);
  var r1 = new THREE.Mesh(new THREE.ConeGeometry(9,3,20), MAT.roofB); r1.position.y=11.2; g.add(r1);
  var r2 = new THREE.Mesh(new THREE.ConeGeometry(6.2,2.6,20), MAT.roofB); r2.position.y=13.6; g.add(r2);
  var r3 = new THREE.Mesh(new THREE.ConeGeometry(3.4,2.4,20), MAT.roofB); r3.position.y=15.8; g.add(r3);
  var tip = new THREE.Mesh(new THREE.SphereGeometry(0.7,10,8), MAT.gold||MAT.roofY); tip.position.y=17.4; g.add(tip);
  // Himmelsaltar daneben
  var a1 = cyl(8,8,1.2,MAT.marble,20); a1.position.set(22,0,6); g.add(a1);
  var a2 = cyl(6,6,1.2,MAT.marbleD,20); a2.position.set(22,1.2,6); g.add(a2);
  g.position.set(-80,0,50);
  addCollider(-80,50,17); addCollider(-58,56,9);
  var l = makeLabel('Himmelstempel','Temple of Heaven'); l.position.set(-80,30,50); g.add(l);
  return g;
}
function buildSummer(){
  var g = new THREE.Group();
  var lake = new THREE.Mesh(new THREE.CircleGeometry(27,28), MAT.water);
  lake.rotation.x=-Math.PI/2; lake.position.set(0,0.06,8); g.add(lake);
  // 17-Bögen-Brücke (Bogen aus Segmenten)
  for (var i=0;i<=8;i++){
    var a = Math.PI*(i/8);
    var bx = -16*Math.cos(a), bz = 8-16*Math.sin(a)*0.9, by = 1+5*Math.sin(a);
    var segB = new THREE.Mesh(new THREE.BoxGeometry(4.6,1.4,3.4), MAT.marble);
    segB.position.set(bx,by,bz); segB.rotation.z = (a-Math.PI/2)*0.5; g.add(segB);
  }
  var isl = cyl(9,10,2.4,MAT.green,16); isl.position.set(0,0,-12); g.add(isl);
  var pav = hall(6.5,6.5,4,3,MAT.wallRed,MAT.roofY,MAT.roofYd,0.8); pav.position.set(0,2.4,-12); g.add(pav);
  // Wandelgang
  var corr = box(44,3.6,5,MAT.wood); corr.position.set(0,0,-24); g.add(corr);
  var croof = hipRoof(46,7,2.8,MAT.roofG,MAT.roofGd); croof.position.set(0,3.6,-24); g.add(croof);
  // Hügel + Pagode
  var hill = new THREE.Mesh(new THREE.ConeGeometry(19,13,12), MAT.greenD);
  hill.position.set(-34,6.5,-14); g.add(hill);
  for (var f=0;f<4;f++){
    var s = 7-f*1.3;
    var fl = new THREE.Mesh(new THREE.BoxGeometry(s,2.4,s), MAT.stone);
    fl.position.set(-34, 13+f*3.4, -14); g.add(fl);
    var fr = hipRoof(s+1.6,s+1.6,1.6,MAT.roofG,MAT.roofGd); fr.position.set(-34, 14.2+f*3.4, -14); g.add(fr);
  }
  g.position.set(85,0,60);
  addCollider(85,68,25); addCollider(51,46,17); addCollider(85,36,20);
  var l = makeLabel('Sommerpalast','Summer Palace'); l.position.set(85,30,60); g.add(l);
  return g;
}
function buildQianmen(){
  var g = new THREE.Group();
  var plat = box(22,6,11,MAT.stone); at(plat,0,0,0); g.add(plat);
  var arch = new THREE.Mesh(new THREE.BoxGeometry(6,4.5,12), MAT.dark);
  arch.position.set(0,2.2,0); g.add(arch);
  var tw = hall(19,10,7,5,MAT.wallRed,MAT.roofG,MAT.roofGd,0); tw.position.set(0,6,0); g.add(tw);
  // Paifang davor
  [-5,5].forEach(function(x){ var p = cyl(0.7,0.7,10,MAT.wallRed); p.position.set(x,0,16); g.add(p); });
  var pr = hipRoof(15,4,3.2,MAT.roofB,MAT.roofBd); pr.position.set(0,10,16); g.add(pr);
  // Wangfujing-Läden
  for (var i=0;i<4;i++){
    [-1,1].forEach(function(s){
      var sh = new THREE.Group();
      var b = box(9,5.5,7,MAT.white); sh.add(b);
      var r = hipRoof(10.5,8.5,2.6,MAT.roofG,MAT.roofGd); r.position.y=5.5; sh.add(r);
      var sign = new THREE.Mesh(new THREE.BoxGeometry(5,1.4,0.4), i%2?MAT.wallRed:MAT.roofB);
      sign.position.set(0,4.4,3.7); sh.add(sign);
      sh.position.set(s*13, 0, 30+i*13); g.add(sh);
      addCollider(s*13, 66+30+i*13, 7);
    });
  }
  g.position.set(0,0,66);
  addCollider(0,66,15);
  var l = makeLabel('Qianmen & Wangfujing','Qianmen & Wangfujing'); l.position.set(0,30,66); g.add(l);
  return g;
}
function addPath(x1,z1,x2,z2,w){
  var dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
  var geo = new THREE.PlaneGeometry(w||6, len);
  geo.rotateX(-Math.PI/2); geo.rotateY(Math.atan2(dx,dz));
  var m = new THREE.Mesh(geo, MAT.sand);
  m.position.set((x1+x2)/2, 0.04, (z1+z2)/2);
  scene.add(m);
}
/* ================= Figur ================= */
var player, legL, legR, armL, armR, pAngle = Math.PI;
function buildPlayer(){
  var g = new THREE.Group();
  var bodyM = lam(0x2e9e8b), skinM = lam(0xf2c89b);
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.72,1.7,12), bodyM); body.position.y=1.55; g.add(body);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.52,14,12), skinM); head.position.y=2.85; g.add(head);
  var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.54,0.54,0.28,12), lam(0xe74c3c)); cap.position.y=3.2; g.add(cap);
  var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.72,0.08,12), lam(0xe74c3c)); brim.position.y=3.08; g.add(brim);
  [-1,1].forEach(function(s){
    var eye = new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6), MAT.dark);
    eye.position.set(s*0.2, 2.92, 0.46); g.add(eye);
  });
  legL = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,1.1,8), lam(0x34495e));
  legL.geometry.translate(0,-0.55,0); legL.position.set(-0.28,1.0,0); g.add(legL);
  legR = legL.clone(); legR.position.x=0.28; g.add(legR);
  armL = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.18,1.0,8), bodyM);
  armL.geometry.translate(0,-0.5,0); armL.position.set(-0.78,2.2,0); g.add(armL);
  armR = armL.clone(); armR.position.x=0.78; g.add(armR);
  var pack = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.9,0.4), lam(0xe67e22));
  pack.position.set(0,1.9,-0.62); g.add(pack);
  g.position.set(0,0,128);
  return g;
}
/* ================= Init ================= */
var scene, camera, renderer, clock, clouds=[];
var keys = {};
var joyVec = {x:0, y:0};
function init(){
  var canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaed6e8);
  scene.fog = new THREE.Fog(0xaed6e8, 140, 400);
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x8a9a7a, 0.95));
  var sun = new THREE.DirectionalLight(0xfff2d8, 0.85);
  sun.position.set(80,120,60); scene.add(sun);
  // Boden
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(420,420), lam(0xa9c795));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  // Wege
  addPath(0,128,0,80); addPath(0,80,0,44); addPath(0,44,0,-6);
  addPath(0,-6,-62,-30); addPath(0,30,-58,44); addPath(0,-6,62,-44); addPath(0,34,60,52);
  addPath(0,-74,0,-88); addPath(0,-114,0,-136);
  // Landmarks
  scene.add(buildForbidden()); scene.add(buildJingshan()); scene.add(buildWall());
  scene.add(buildLama()); scene.add(buildHutong()); scene.add(buildHeaven());
  scene.add(buildSummer()); scene.add(buildQianmen());
  // Bäume
  for (var i=0;i<46;i++){
    var tx = (Math.random()*2-1)*175, tz = (Math.random()*2-1)*175;
    var bad = colliders.some(function(c){ return Math.hypot(tx-c.x,tz-c.z) < c.r+4; });
    if (bad) continue;
    var tr = new THREE.Group();
    var trunk = cyl(0.35,0.45,2.2,MAT.wood); tr.add(trunk);
    var crn = new THREE.Mesh(new THREE.ConeGeometry(2.2,4.5,8), Math.random()<0.5?MAT.green:MAT.greenD);
    crn.position.y = 4.2; tr.add(crn);
    tr.position.set(tx,0,tz); scene.add(tr);
  }
  // Wolken
  for (var w=0;w<6;w++){
    var cl = new THREE.Group();
    for (var k=0;k<3;k++){
      var s = new THREE.Mesh(new THREE.SphereGeometry(4+Math.random()*3,10,8), lam(0xffffff));
      s.position.set(k*5-5, Math.random()*2, Math.random()*3); s.scale.y=0.55; cl.add(s);
    }
    cl.position.set((Math.random()*2-1)*180, 62+Math.random()*22, (Math.random()*2-1)*180);
    clouds.push(cl); scene.add(cl);
  }
  // Spieler
  player = buildPlayer(); scene.add(player);
  // Checkliste
  var ul = document.getElementById('cl-list');
  LM.forEach(function(l){
    var li = document.createElement('li'); li.id='cl-'+l.id;
    li.textContent = '☐ ' + l.de; ul.appendChild(li);
  });
  bindInput(canvas);
  resize();
  window.addEventListener('resize', resize);
  clock = new THREE.Clock();
  requestAnimationFrame(loop);
}
function resize(){
  var canvas = document.getElementById('game-canvas');
  var w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
/* ================= Input ================= */
function bindInput(canvas){
  window.addEventListener('keydown', function(e){
    var k = e.key.toLowerCase();
    keys[k]=true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].indexOf(k)>=0) e.preventDefault();
  });
  window.addEventListener('keyup', function(e){ keys[e.key.toLowerCase()]=false; });
  // Touch-Joystick
  var base = document.getElementById('joy-base'), knob = document.getElementById('joy-knob');
  var joyId = null, ox=0, oy=0;
  function showJoy(t){
    var r = canvas.getBoundingClientRect();
    ox = t.clientX - r.left; oy = t.clientY - r.top;
    base.style.display='block';
    base.style.left=(ox-60)+'px'; base.style.top=(oy-60)+'px'; base.style.bottom='auto';
    knob.style.transform='translate(-50%,-50%)';
  }
  canvas.addEventListener('touchstart', function(e){
    var t = e.changedTouches[0]; joyId = t.identifier; showJoy(t); e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchmove', function(e){
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i]; if (t.identifier!==joyId) continue;
      var r = canvas.getBoundingClientRect();
      var dx=(t.clientX-r.left)-ox, dy=(t.clientY-r.top)-oy;
      var d=Math.hypot(dx,dy), max=48;
      if (d>max){ dx=dx/d*max; dy=dy/d*max; }
      knob.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
      joyVec.x=dx/max; joyVec.y=dy/max;
    }
    e.preventDefault();
  }, {passive:false});
  function endTouch(e){
    for (var i=0;i<e.changedTouches.length;i++){
      if (e.changedTouches[i].identifier===joyId){
        joyId=null; joyVec.x=0; joyVec.y=0; base.style.display='none';
      }
    }
  }
  canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
}
/* ================= Loop ================= */
var toastTimer=null, walkT=0;
function toast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
}
function loop(){
  requestAnimationFrame(loop);
  var dt = Math.min(clock.getDelta(), 0.05);
  // Input
  var ix=0, iz=0;
  if (keys['w']||keys['arrowup']) iz-=1;
  if (keys['s']||keys['arrowdown']) iz+=1;
  if (keys['a']||keys['arrowleft']) ix-=1;
  if (keys['d']||keys['arrowright']) ix+=1;
  ix += joyVec.x; iz += joyVec.y;
  var len = Math.hypot(ix,iz);
  var moving = len>0.12;
  if (moving){
    if (len>1){ ix/=len; iz/=len; }
    var sp = 17*dt;
    player.position.x += ix*sp; player.position.z += iz*sp;
    // Kollision
    for (var i=0;i<colliders.length;i++){
      var c=colliders[i], dx=player.position.x-c.x, dz=player.position.z-c.z;
      var d=Math.hypot(dx,dz);
      if (d < c.r+0.9 && d > 0.001){
        player.position.x = c.x + dx/d*(c.r+0.9);
        player.position.z = c.z + dz/d*(c.r+0.9);
      }
    }
    player.position.x = Math.max(-178, Math.min(178, player.position.x));
    player.position.z = Math.max(-178, Math.min(178, player.position.z));
    var targetA = Math.atan2(ix, iz);
    var da = targetA - pAngle;
    while (da>Math.PI) da-=Math.PI*2; while (da<-Math.PI) da+=Math.PI*2;
    pAngle += da*Math.min(1, dt*10);
    walkT += dt*11;
    var sw = Math.sin(walkT)*0.55;
    legL.rotation.x=sw; legR.rotation.x=-sw; armL.rotation.x=-sw*0.7; armR.rotation.x=sw*0.7;
    player.position.y = Math.abs(Math.sin(walkT))*0.12;
  } else {
    legL.rotation.x*=0.85; legR.rotation.x*=0.85; armL.rotation.x*=0.85; armR.rotation.x*=0.85;
    player.position.y*=0.9;
  }
  player.rotation.y = pAngle;
  // Kamera folgt
  var cd=15, ch=10.5;
  var cx = player.position.x - Math.sin(pAngle)*cd;
  var cz = player.position.z - Math.cos(pAngle)*cd;
  var k = 1-Math.pow(0.002, dt);
  camera.position.x += (cx-camera.position.x)*k;
  camera.position.y += (ch-camera.position.y)*k;
  camera.position.z += (cz-camera.position.z)*k;
  camera.lookAt(player.position.x, 3.2, player.position.z);
  // Wolken
  for (var ci=0;ci<clouds.length;ci++){
    clouds[ci].position.x += dt*1.2;
    if (clouds[ci].position.x>200) clouds[ci].position.x=-200;
  }
  // Besucht?
  for (var li=0;li<LM.length;li++){
    var L=LM[li];
    if (!visited[L.id] && Math.hypot(player.position.x-L.x, player.position.z-L.z) < L.r){
      visited[L.id]=true;
      var n=Object.keys(visited).length;
      var el=document.getElementById('cl-'+L.id);
      if (el){ el.classList.add('done'); el.textContent='☑ '+L.de; }
      toast('✓ '+L.de+' · '+L.en+'  ('+n+'/8)');
      if (n===LM.length) setTimeout(function(){ toast('🎉 Alle 8 Stationen! Gute Reise nach Peking!'); }, 2800);
    }
  }
}
})();
