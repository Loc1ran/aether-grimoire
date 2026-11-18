"""Bake the MIT WebXR hand into a closed sword grip; coordinates are sword-local meters."""
import bpy, json, os
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'art','hand-source.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
hand=bpy.data.objects['r_handMeshNode']
rest={b.name:b.head_local.copy() for b in rig.data.bones}
turn=Matrix.Rotation(1.16,4,'X')
wrist=Vector((.045,-.070,.033))
def palm(p): return wrist+turn.to_3x3()@(p-rest['wrist'])
targets={n:palm(p) for n,p in rest.items()}
chains=[]
for i,finger in enumerate(['index','middle','ring','pinky']):
    chain=[finger+'-finger-'+part for part in ['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip']]
    y=.025-i*.022
    targets[chain[1]]=Vector((.039 if i<3 else .032,y,.023))
    targets[chain[2]]=Vector((-.003,y-.002,.028))
    targets[chain[3]]=Vector((-.026,y-.004,.009))
    targets[chain[4]]=Vector((-.025,y-.005,-.006))
    chains.append(chain)
thumb=['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip']
for n,p in zip(thumb[1:],[(.014,.026,.039),(-.010,.028,.009),(.000,.020,-.015)]): targets[n]=Vector(p)
chains.append(thumb)
rig.pose.bones['wrist'].matrix=Matrix.Translation(wrist)@turn@Matrix.Translation(-rest['wrist'])@rig.data.bones['wrist'].matrix_local
for chain in chains:
    for i,n in enumerate(chain):
        a,b=(chain[i],chain[i+1]) if i<len(chain)-1 else (chain[i-1],chain[i])
        rotation=(rest[b]-rest[a]).rotation_difference(targets[b]-targets[a]).to_matrix().to_4x4()
        rig.pose.bones[n].matrix=Matrix.Translation(targets[n])@rotation@Matrix.Translation(-rest[n])@rig.data.bones[n].matrix_local
bpy.context.view_layer.update()
mesh=hand.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
mesh.calc_loop_triangles()
data={'position':[round(v,6) for p in mesh.vertices for v in p.co],
      'normal':[round(v,6) for p in mesh.vertices for v in p.normal],
      'index':[i for t in mesh.loop_triangles for i in t.vertices]}
assert len(data['position'])==1360*3
with open(os.path.join(ROOT,'src','scene-assets','sword-hand.json'),'w') as out: json.dump(data,out,separators=(',',':'))
print('Baked continuous grip:',len(mesh.vertices),'vertices;',len(mesh.loop_triangles),'triangles')
