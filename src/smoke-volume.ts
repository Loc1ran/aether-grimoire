import { InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, Vector3 } from '@iwsdk/core';
import { spellMaterial } from './spell-material.js';

/** A fixed pool of textured, camera-facing billows; one draw call per cloud. */
export class SmokeVolume {
  readonly mesh: InstancedMesh<PlaneGeometry,MeshBasicMaterial>;
  private readonly stamp=new Object3D();
  private readonly roll=new Quaternion();
  private readonly axis=new Vector3(0,0,1);
  private readonly view=new Quaternion();
  private readonly alpha: InstancedBufferAttribute;

  constructor(readonly count:number,color=0x696861) {
    const geometry=new PlaneGeometry(1,1);
    this.alpha=new InstancedBufferAttribute(new Float32Array(count),1);
    geometry.setAttribute('smokeOpacity',this.alpha);
    const material=spellMaterial('smoke');material.color.setHex(color);
    const compile=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);
      shader.vertexShader='attribute float smokeOpacity; varying float billowAlpha;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbillowAlpha=smokeOpacity;');
      shader.fragmentShader='varying float billowAlpha;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= billowAlpha;\n#include <alphatest_fragment>');
    };
    material.customProgramCacheKey=()=>`aether-billows-${!!material.map}`;
    this.mesh=new InstancedMesh(geometry,material,count);this.mesh.name='VolumetricSmokeCards';this.mesh.frustumCulled=false;
    this.mesh.userData.iwsdkPreviewBounds='exclude';
  }
  setView(rotation:Quaternion):void { this.view.copy(rotation); }
  particle(index:number,x:number,y:number,z:number,size:number,angle:number,opacity:number):void {
    this.stamp.position.set(x,y,z);this.stamp.scale.setScalar(size);
    this.stamp.quaternion.copy(this.view).multiply(this.roll.setFromAxisAngle(this.axis,angle));
    this.stamp.updateMatrix();this.mesh.setMatrixAt(index,this.stamp.matrix);this.alpha.setX(index,opacity);
  }
  commit():void { this.mesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true; }
  dispose():void { this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.dispose(); }
}
