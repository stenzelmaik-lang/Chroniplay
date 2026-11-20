import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildDollModel} from '../app/spielbereich/modules/spieltisch/spielpause/doll-3d.js';
import {dollPose} from '../app/spielbereich/modules/spieltisch/spielpause/doll-pose.js';

test('Graf has closed, substantial head/body volumes and a thick rear cloak',()=>{
  const doll=buildDollModel();
  for(const [name,depth] of [['stuffed head',1.3],['waistcoat stuffed torso',.85],['thick velvet cloak',.17]]){
    const mesh=doll.children.find(n=>n.name===name);mesh.geometry.computeBoundingBox();
    const size=mesh.geometry.boundingBox.getSize(new T.Vector3());assert.ok(size.z>=depth,name);
    assert.ok(mesh.geometry.attributes.normal.array.some(v=>v<-.5),'rear surface normals exist');
  }
  assert.equal(doll.children.filter(n=>n.name==='glass button eye').length,2);
  assert.ok(doll.children.filter(n=>n.name==='rear head stitch').length>10);
});

test('Back landing faces upward, rests above the tabletop and stands back on its feet',()=>{
  const doll=buildDollModel(),vertex=new T.Vector3();
  assert.ok(dollPose(.01).y>3);
  assert.ok(Math.abs(dollPose(.56).x+Math.PI/2)<.01);
  assert.deepEqual(dollPose(1),{x:0,y:0,z:0,squash:0});
  for(let step=0;step<=50;step++){
    const pose=dollPose(step/50);doll.rotation.x=pose.x;doll.position.y=pose.y;doll.updateMatrixWorld(true);
    let bottom=Infinity;
    for(const mesh of doll.children){const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)bottom=Math.min(bottom,vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).y);
    }
    assert.ok(bottom>=-.055,'solid doll does not pass through the table at '+step);
  }
});
