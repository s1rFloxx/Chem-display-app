import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
 * ChemViewer 3D
 * Hlavní logika je rozdělena na:
 * 1) načtení databáze,
 * 2) vytvoření 3D objektů,
 * 3) aktualizaci informačního panelu,
 * 4) import XYZ,
 * 5) animační smyčku.
 *
 * Molekuly samotné nejsou v tomto souboru. Jsou v molecules.json,
 * takže další verze mohou být kratší a přidávání molekul je jednodušší.
 */

const viewportEl=document.getElementById("viewport");
const moleculeSelect=document.getElementById("molecule-select");
const propName=document.getElementById("prop-name");
const propFormula=document.getElementById("prop-formula");
const propMass=document.getElementById("prop-mass");
const propHybridization=document.getElementById("prop-hybridization");
const propGeometry=document.getElementById("prop-geometry");
const propAngle=document.getElementById("prop-angle");
const legendList=document.getElementById("legend-list");
const teacherWarning=document.getElementById("teacher-warning");
const uploadBtn=document.getElementById("upload-btn");
const fileInput=document.getElementById("file-input");
const uploadStatus=document.getElementById("upload-status");

/* -------------------- Three.js scéna -------------------- */
const scene=new THREE.Scene();

const camera=new THREE.PerspectiveCamera(
  45, viewportEl.clientWidth/viewportEl.clientHeight, 0.1, 100
);
camera.position.set(0,0,7);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(viewportEl.clientWidth,viewportEl.clientHeight);
renderer.setClearColor(0xffffff,1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
viewportEl.appendChild(renderer.domElement);

// Silnější studiové osvětlení napodobuje lesklé školní molekulární modely.
scene.add(new THREE.AmbientLight(0xffffff,1.0));
const keyLight=new THREE.DirectionalLight(0xffffff,2.2);
keyLight.position.set(4,7,8);
scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0xffffff,1.0);
fillLight.position.set(-5,2,4);
scene.add(fillLight);

// Ovládání modelu myší.
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=0.08;
controls.minDistance=2;
controls.maxDistance=18;

// Všechny objekty právě zobrazené molekuly jsou v jedné skupině.
const moleculeGroup=new THREE.Group();
scene.add(moleculeGroup);

let database=null;

/* -------------------- Databáze -------------------- */
async function loadDatabase(){
  // molecules.json je oddělená databáze molekul.
  const response=await fetch("./molecules.json");
  if(!response.ok) throw new Error("Nepodařilo se načíst molecules.json.");
  database=await response.json();

  fillMoleculeSelect();
  loadMolecule(Object.keys(database.molecules)[0]);
}

function elementInfo(symbol){
  // Pokud je prvek v databázi, vrátíme jeho jméno, barvu a velikost.
  return database.elements[symbol] ?? {
    name:symbol,color:"#cccccc",radius:0.4
  };
}

/* -------------------- Vytváření 3D modelu -------------------- */
function clearMolecule(){
  // Odstraníme předchozí molekulu a uvolníme její GPU prostředky.
  while(moleculeGroup.children.length>0){
    const object=moleculeGroup.children.pop();
    object.traverse(child=>{
      child.geometry?.dispose();
      child.material?.dispose();
    });
  }
}

function makeAtom(element){
  const info=elementInfo(element);
  const geometry=new THREE.SphereGeometry(info.radius,48,48);
  const material=new THREE.MeshStandardMaterial({
    color:info.color,
    roughness:0.16,
    metalness:0.03
  });
  return new THREE.Mesh(geometry,material);
}

function makeCylinderSegment(start,end,color,radius=0.085){
  const direction=new THREE.Vector3().subVectors(end,start);
  const length=direction.length();
  const midpoint=new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5);
  const geometry=new THREE.CylinderGeometry(radius,radius,length,20);
  const material=new THREE.MeshStandardMaterial({
    color,
    roughness:0.22,
    metalness:0.02
  });
  const cylinder=new THREE.Mesh(geometry,material);
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0,1,0),direction.normalize()
  );
  return cylinder;
}

function makeBond(start,end,order=1,startElement="C",endElement="C"){
  /*
   * Vazby jsou stylizované jako na referenčním modelu:
   * každý válec je u každého atomu zbarvený barvou daného prvku.
   * Dvojná vazba má dva rovnoběžné barevné válce.
   */
  const direction=new THREE.Vector3().subVectors(end,start).normalize();
  const distance=new THREE.Vector3().subVectors(end,start).length();
  const midpoint=new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5);
  const group=new THREE.Group();
  const startInfo=elementInfo(startElement);
  const endInfo=elementInfo(endElement);
  const trimStart=Math.min(startInfo.radius*0.72,distance*0.22);
  const trimEnd=Math.min(endInfo.radius*0.72,distance*0.22);
  const firstEnd=midpoint.clone();
  const firstStart=start.clone().addScaledVector(direction,trimStart);
  const secondStart=midpoint.clone();
  const secondEnd=end.clone().addScaledVector(direction,-trimEnd);

  let perpendicular=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0));
  if(perpendicular.lengthSq()<0.001){
    perpendicular=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(1,0,0));
  }
  perpendicular.normalize();

  const count=Math.max(1,order);
  const offset=count===2?0.105:0;
  for(let i=0;i<count;i++){
    const shift=perpendicular.clone().multiplyScalar(count===2?(i===0?offset:-offset):0);
    group.add(makeCylinderSegment(firstStart.clone().add(shift),firstEnd.clone().add(shift),startInfo.color));
    group.add(makeCylinderSegment(secondStart.clone().add(shift),secondEnd.clone().add(shift),endInfo.color));
  }
  return group;
}

function makeLonePair(position,direction){
  /*
   * Volný elektronový pár je zobrazen jako průsvitný „lalok“
   * se dvěma malými bílými elektrony uvnitř — podobně jako na
   * referenčním obrázku.
   */
  const group=new THREE.Group();
  const dir=new THREE.Vector3(...direction).normalize();

  let side=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,0,1));
  if(side.lengthSq()<0.001) side=new THREE.Vector3(1,0,0);
  side.normalize();

  const center=new THREE.Vector3(...position).addScaledVector(dir,0.78);
  const lobeGeometry=new THREE.SphereGeometry(0.66,40,28);
  const lobeMaterial=new THREE.MeshPhysicalMaterial({
    color:0x8d8ff5,
    transparent:true,
    opacity:0.38,
    roughness:0.12,
    transmission:0.15,
    thickness:0.35,
    depthWrite:false
  });
  const lobe=new THREE.Mesh(lobeGeometry,lobeMaterial);
  lobe.position.copy(center);
  lobe.scale.set(0.92,0.92,1.28);
  lobe.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
  group.add(lobe);

  [-1,1].forEach(sign=>{
    const geometry=new THREE.SphereGeometry(0.09,20,20);
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.12});
    const electron=new THREE.Mesh(geometry,material);
    electron.position.copy(center)
      .addScaledVector(side,sign*0.13)
      .addScaledVector(dir,-0.42);
    group.add(electron);
  });
  return group;
}

function buildMolecule(data){
  clearMolecule();

  const positions=data.atoms.map(atom=>new THREE.Vector3(...atom.position));

  // 1. atomy
  data.atoms.forEach((atom,index)=>{
    const mesh=makeAtom(atom.element);
    mesh.position.copy(positions[index]);
    moleculeGroup.add(mesh);
  });

  // 2. vazby
  data.bonds.forEach(bond=>{
    moleculeGroup.add(makeBond(
      positions[bond.from],
      positions[bond.to],
      bond.order,
      data.atoms[bond.from].element,
      data.atoms[bond.to].element
    ));
  });

  // 3. volné elektronové páry
  const pairDirections=[[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  data.lonePairs?.forEach(pairData=>{
    const atomPosition=positions[pairData.atom];
    const directions=pairData.directions ?? pairDirections;
    for(let i=0;i<pairData.count;i++){
      moleculeGroup.add(makeLonePair(
        atomPosition,
        directions[i%directions.length]
      ));
    }
  });

  // Kamera se nastaví na střed aktuálního modelu.
  const box=new THREE.Box3().setFromObject(moleculeGroup);
  const center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3());
  controls.target.copy(center);
  controls.update();
  camera.position.set(center.x,center.y,center.z+Math.max(5,size.length()*1.6));
}

/* -------------------- Informační panel -------------------- */
function updatePanel(data){
  propName.textContent=data.name;
  propFormula.textContent=data.formula;
  propMass.textContent=data.molarMass;
  propHybridization.textContent=data.hybridization;
  propGeometry.textContent=data.geometry;
  propAngle.textContent=data.bondAngle;

  // U problematického zadání zobrazíme upozornění místo tichého "opravení".
  teacherWarning.hidden=!data.warning;
  teacherWarning.textContent=data.warning??"";
}

function updateLegend(atoms){
  const usedElements=[...new Set(atoms.map(atom=>atom.element))];
  legendList.innerHTML="";

  usedElements.forEach(symbol=>{
    const info=elementInfo(symbol);
    const item=document.createElement("div");
    item.className="legend-item";
    item.innerHTML=`
      <span class="legend-dot" style="background:${info.color}"></span>
      <span>${info.name} (${symbol})</span>
    `;
    legendList.appendChild(item);
  });
}

/* -------------------- Výběr molekuly -------------------- */
function fillMoleculeSelect(){
  moleculeSelect.innerHTML="";
  Object.entries(database.molecules).forEach(([key,data])=>{
    const option=document.createElement("option");
    option.value=key;
    option.textContent=`${data.name} (${data.formula})`;
    moleculeSelect.appendChild(option);
  });
}

function loadMolecule(key){
  const data=database.molecules[key];
  if(!data) return;
  buildMolecule(data);
  updatePanel(data);
  updateLegend(data.atoms);
  setUploadStatus("");
}

moleculeSelect.addEventListener("change",event=>{
  loadMolecule(event.target.value);
});

/* -------------------- XYZ import -------------------- */
function setUploadStatus(message,type=""){
  uploadStatus.textContent=message;
  uploadStatus.className=type;
}

uploadBtn.addEventListener("click",()=>fileInput.click());

fileInput.addEventListener("change",event=>{
  const file=event.target.files[0];
  if(!file) return;

  const reader=new FileReader();

  reader.onload=()=>{
    try{
      const parsed=parseXYZ(reader.result);
      buildMolecule(parsed);
      updatePanel({
        name:file.name.replace(/\.[^/.]+$/,""),
        formula:"—",molarMass:"—",hybridization:"—",
        geometry:"—",bondAngle:"—",lonePairs:[]
      });
      updateLegend(parsed.atoms);
      setUploadStatus(`Načteno: ${parsed.atoms.length} atomů`,"ok");
    }catch(error){
      setUploadStatus(`Chyba: ${error.message}`,"error");
    }
  };

  reader.onerror=()=>setUploadStatus("Soubor se nepodařilo přečíst.","error");
  reader.readAsText(file);
});

function parseXYZ(text){
  /*
   * Standardní XYZ:
   * řádek 1 = počet atomů
   * řádek 2 = komentář
   * další řádky = prvek X Y Z
   */
  const lines=text.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<3) throw new Error("Neplatný .xyz formát.");

  const count=Number.parseInt(lines[0],10);
  if(Number.isNaN(count)) throw new Error("První řádek musí obsahovat počet atomů.");

  const atomLines=lines.slice(2,2+count);
  if(atomLines.length!==count) throw new Error("Počet atomů neodpovídá obsahu souboru.");

  const atoms=atomLines.map((line,index)=>{
    const parts=line.split(/\s+/);
    if(parts.length<4) throw new Error(`Řádek ${index+3}: očekává se prvek x y z.`);

    const [element,x,y,z]=parts;
    const position=[Number(x),Number(y),Number(z)];
    if(position.some(Number.isNaN)) throw new Error(`Neplatné souřadnice na řádku ${index+3}.`);
    return {element,position};
  });

  // U cizího XYZ souboru nemusíme znát řád vazby, proto použijeme jednoduchý odhad.
  const bonds=[];
  const threshold=1.7;

  for(let i=0;i<atoms.length;i++){
    for(let j=i+1;j<atoms.length;j++){
      const a=atoms[i].position,b=atoms[j].position;
      const dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];
      const distance=Math.sqrt(dx*dx+dy*dy+dz*dz);
      if(distance<threshold) bonds.push({from:i,to:j,order:1});
    }
  }

  return {atoms,bonds,lonePairs:[]};
}

/* -------------------- Animace + změna velikosti -------------------- */
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}

window.addEventListener("resize",()=>{
  const width=viewportEl.clientWidth,height=viewportEl.clientHeight;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height);
});

loadDatabase().catch(error=>{
  console.error(error);
  setUploadStatus(error.message,"error");
});

animate();
