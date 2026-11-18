import * as T from 'three';
import {dollPose} from './doll-pose.js';

const PHOTO_WIDTH=3.50, PHOTO_HEIGHT=3.80;

/** Each stuffed part has a closed surface. The photo is projected onto its
 * front; sides/back use cloth, rather than reflecting the face onto the back. */
function cloth(photo,bump,color) {
  const base=new T.Color(color);
  const material=new T.MeshStandardMaterial({color:photo?0xffffff:color,map:photo,bumpMap:bump,bumpScale:.018,roughness:.94,metalness:0});
  if(photo)material.onBeforeCompile=shader=>{
    shader.uniforms.clothBack={value:base};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 dollNormal;')
      .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\ndollNormal = objectNormal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 dollNormal;\nuniform vec3 clothBack;')
      .replace('#include <map_fragment>','#include <map_fragment>\nfloat front = smoothstep(0.12,0.72,normalize(dollNormal).z) * step(0.4,diffuseColor.a);\ndiffuseColor.rgb = mix(clothBack,diffuseColor.rgb,front);\ndiffuseColor.a = 1.0;');
  };
  material.customProgramCacheKey=()=>photo?'doll-projected-cloth-v1':'doll-cloth-v1';
  return material;
}

function project(geometry) {
  const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/PHOTO_WIDTH+.5;uv[i*2+1]=p.getY(i)/PHOTO_HEIGHT;}
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));return geometry;
}

export function buildDollModel(photo=null,bump=null) {
  const doll=new T.Group();doll.name='Graf Knautsch · volumetric plush';
  const skin=cloth(photo,bump,'#e4c9c5'),dark=cloth(photo,bump,'#302931'),red=cloth(photo,bump,'#641e36');
  function part(name,geometry,material,position,scale=[1,1,1],rotation=[0,0,0]){
    geometry.scale(...scale);geometry.rotateX(rotation[0]);geometry.rotateY(rotation[1]);geometry.rotateZ(rotation[2]);geometry.translate(...position);
    const mesh=new T.Mesh(project(geometry),material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;doll.add(mesh);return mesh;
  }
  const sphere=(name,material,position,scale,rotation)=>part(name,new T.SphereGeometry(1,40,28),material,position,scale,rotation);
  // Black hair is present on the rear as well: the head is an ellipsoid, not a card.
  const head=cloth(photo,bump,'#28232b');
  sphere('stuffed head',head,[0,2.62,0],[1.03,.79,.66]);
  for(const side of [-1,1]){
    part('pointed ear',new T.ConeGeometry(.20,.58,20,6),skin,[side*1.04,2.63,.02],[1,1,.65],[0,0,-side*1.12]);
    sphere('sleeve',skin,[side*.89,1.43,0],[.29,.48,.31],[0,0,side*.65]);
    sphere('cuff',skin,[side*1.05,1.19,.12],[.30,.20,.31],[0,0,side*.65]);
    sphere('stuffed hand',skin,[side*1.12,1.13,.23],[.30,.28,.31]);
    sphere('trouser leg',dark,[side*.36,.55,0],[.34,.50,.35],[0,0,-side*.08]);
    sphere('soft boot',dark,[side*.38,.18,.18],[.39,.21,.49]);
    sphere('bow tie wing',red,[side*.21,1.86,.48],[.27,.17,.13],[0,0,-side*.22]);
  }
  sphere('waistcoat stuffed torso',red,[0,1.30,0],[.66,.64,.43]);
  sphere('bow knot',red,[0,1.86,.53],[.12,.13,.11]);
  // A thick, scalloped cloak, including its back and edge faces.
  const cape=new T.Shape();cape.moveTo(-.55,1.96);cape.quadraticCurveTo(-1.0,1.91,-1.08,1.48);
  cape.bezierCurveTo(-1.25,1.00,-1.52,.54,-1.70,.36);
  cape.quadraticCurveTo(-1.45,.51,-1.28,.22);cape.quadraticCurveTo(-1.04,.48,-.82,.19);
  cape.quadraticCurveTo(-.48,.44,0,.22);cape.quadraticCurveTo(.48,.44,.82,.19);
  cape.quadraticCurveTo(1.04,.48,1.28,.22);cape.quadraticCurveTo(1.45,.51,1.70,.36);
  cape.bezierCurveTo(1.52,.54,1.25,1.00,1.08,1.48);cape.quadraticCurveTo(1.0,1.91,.55,1.96);cape.closePath();
  part('thick velvet cloak',new T.ExtrudeGeometry(cape,{depth:.11,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.045,bevelThickness:.035,curveSegments:12}),dark,[0,0,-.42]);
  for(const side of [-1,1]){
    const collar=new T.Shape();collar.moveTo(side*.25,1.86);collar.quadraticCurveTo(side*.70,2.12,side*1.02,2.07);collar.quadraticCurveTo(side*.98,1.85,side*.39,1.73);collar.closePath();
    part('padded collar',new T.ExtrudeGeometry(collar,{depth:.13,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:3,steps:1}),red,[0,0,-.06]);
  }
  const eye=new T.MeshPhysicalMaterial({color:'#100e13',roughness:.15,metalness:.05,clearcoat:1,clearcoatRoughness:.08});
  const shine=new T.MeshBasicMaterial({color:'#fff7e8'});
  const ivory=new T.MeshStandardMaterial({color:'#f5e4bd',roughness:.68});
  for(const side of [-1,1]){
    sphere('glass button eye',eye,[side*.40,2.70,.61],[.145,.17,.095]);
    sphere('eye catchlight',shine,[side*.40-.035,2.76,.694],[.035,.039,.012]);
    part('soft fang',new T.ConeGeometry(.065,.20,18),ivory,[side*.21,2.29,.615],[1,1,.65],[0,0,Math.PI+side*.18]);
  }
  const gold=new T.MeshStandardMaterial({color:'#b19558',roughness:.6,metalness:.35});
  for(const y of [1.40,1.17,.95])sphere('waistcoat button',gold,[0,y,.439],[.061,.061,.026]);
  // Raised stitching follows the curved rear head: visible in the back diagnostic.
  const thread=new T.MeshStandardMaterial({color:'#4b3b47',roughness:1});
  for(let i=0;i<18;i++){
    const a=-1.13+i*.13,y=2.62+Math.sin(a)*.79,z=-Math.cos(a)*.667;
    part('rear head stitch',new T.CapsuleGeometry(.009,.065,3,6),thread,[0,y,z],[1,1,1],[a,0,Math.PI/2]);
  }
  return doll;
}

function fabricTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=6341;
  for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=100+seed%100;pixels.data.set([v,v,v,255],i);}
  ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(14,14);return texture;
}

/** WebGL renders into the same transparent interactive 2D surface as the other
 * toys. No independent animation loop or listeners survive this renderer. */
export function createDollRenderer() {
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(420,370,false);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(29,420/370,.1,50);
  camera.position.set(3.2,4.6,9.0);camera.lookAt(0,1.45,-.65);
  scene.add(new T.HemisphereLight('#fff1df','#4a3749',2.0));
  const key=new T.DirectionalLight('#fff1e2',3.2);key.position.set(-3,7,6);key.castShadow=true;
  key.shadow.mapSize.set(512,512);Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-5,near:.1,far:20});key.shadow.bias=-.001;key.shadow.normalBias=.025;key.shadow.radius=4;scene.add(key);
  const fill=new T.DirectionalLight('#a9bdd3',1.1);fill.position.set(4,3,-5);scene.add(fill);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.ShadowMaterial({color:'#050608',opacity:.40}));floor.rotation.x=-Math.PI/2;floor.position.y=-.045;floor.receiveShadow=true;scene.add(floor);
  const photo=new T.Texture();photo.colorSpace=T.SRGBColorSpace;photo.minFilter=T.LinearFilter;
  const bump=fabricTexture(),doll=buildDollModel(photo,bump);scene.add(doll);
  let disposed=false;
  return {
    setImage(image){photo.image=image;photo.needsUpdate=true;},
    draw(ctx,{progress=1,squeeze=0,wobble=0,inspectYaw=0}={}){
      if(disposed)return;
      const pose=dollPose(progress);
      doll.rotation.set(pose.x,inspectYaw,wobble*.3);
      doll.position.set(0,pose.y,pose.z);
      doll.scale.set(1+squeeze*.25+pose.squash,1-squeeze*.25,1+squeeze*.18-pose.squash*.4);
      renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,420,370);
    },
    dispose(){
      if(disposed)return;disposed=true;
      const materials=new Set();scene.traverse(node=>{node.geometry?.dispose();if(node.material)materials.add(node.material);});
      materials.forEach(material=>material.dispose());photo.dispose();bump.dispose();renderer.dispose();renderer.forceContextLoss();
    }
  };
}
