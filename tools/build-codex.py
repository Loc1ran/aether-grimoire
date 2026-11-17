"""Original articulated codex; build with Blender --background --python this-file."""
import bpy, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.data.scenes.new('Aether Codex Workshop')
bpy.context.window.scene = scene

def xyz(p):
    return (p[0], -p[2], p[1])

def group(name, parent=None):
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.parent = parent
    return ob

def material(name, color, rough=.6, metal=0, image=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(os.path.join(ROOT, 'public', 'textures', image))
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat

leather = material('Midnight dyed calfskin', (.035,.055,.07), .64, .05, 'codex-cover.png')
spine_mat = material('Worn indigo binding', (.055,.075,.09), .66)
gold = material('Antique pale brass', (.58,.4,.17), .32, .78)
paper = material('Ivory cotton parchment', (.79,.73,.59), .88)
edge = material('Parchment edges', (.58,.48,.31), .94)
ribbon_mat = material('Oxblood silk bookmark', (.22,.024,.045), .38)

def mesh(name, verts, faces, mat, parent, uv=None, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in verts], [], faces)
    data.materials.append(mat)
    data.update()
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = parent
    if uv:
        layer = data.uv_layers.new(name='UVMap')
        for loop in data.loops:
            layer.data[loop.index].uv = uv[loop.vertex_index]
    for p in data.polygons:
        p.use_smooth = True
    if bevel:
        modifier = ob.modifiers.new('Soft leather edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        ob.select_set(False)
        normal = ob.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return ob

def slab(name, outline, z, depth, mat, parent, bevel=.001):
    n=len(outline)
    verts=[(x,y,z+d) for d in [-depth/2,depth/2] for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    xs=[p[0] for p in outline]; ys=[p[1] for p in outline]
    uv=[((p[0]-min(xs))/(max(xs)-min(xs)),(p[1]-min(ys))/(max(ys)-min(ys))) for p in verts]
    return mesh(name,verts,faces,mat,parent,uv,bevel)

def rounded(cx, cy, w, h, r):
    points=[]
    for x,y,start in [(cx+w/2-r,cy+h/2-r,0),(cx-w/2+r,cy+h/2-r,90),(cx-w/2+r,cy-h/2+r,180),(cx+w/2-r,cy-h/2+r,270)]:
        for i in range(9):
            a=math.radians(start+i*90/8)
            points.append((x+r*math.cos(a),y+r*math.sin(a)))
    return points

def stroke(name, points, radius, mat, parent):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'; curve.resolution_u=12
    curve.bevel_depth=radius; curve.bevel_resolution=2
    spline=curve.splines.new('POLY'); spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points): p.co=(*xyz(co),1)
    curve.materials.append(mat)
    ob=bpy.data.objects.new(name,curve); scene.collection.objects.link(ob); ob.parent=parent
    return ob

root=group('GrimoireBook')
left=group('CoverLeft',root); right=group('CoverRight',root)
for side,parent in [(-1,left),(1,right)]:
    label='Left' if side<0 else 'Right'
    slab('Cover'+label+'Leather',rounded(side*.106,0,.202,.294,.009),-.022,.012,leather,parent,.0018)
    outline=rounded(side*.106,0,.192,.284,.007)
    stroke('GoldTooledEdge'+label,[(x,y,-.0288) for x,y in outline+[outline[0]]],.00065,gold,parent)
    for end in [-1,1]:
        x=side*.206; y=end*.142
        shape=[(x,y),(x-side*.034,y),(x-side*.025,y-end*.006),(x-side*.009,y-end*.011),(x-side*.006,y-end*.027),(x,y-end*.034)]
        if side*end<0: shape.reverse()
        slab('CornerCap'+label+str(end),shape,-.022,.014,gold,parent,.0007)

# Continuous convex spine and five stitched binding bands.
verts=[]; faces=[]
for j in range(17):
    y=-.146+j*.292/16
    for i in range(17):
        a=math.pi*i/16
        verts.append((math.cos(a)*.016,y,-.024-math.sin(a)*.016))
for j in range(16):
    for i in range(16):
        a=j*17+i; faces.append((a,a+1,a+18,a+17))
mesh('Spine',verts,faces,spine_mat,root)
for k,y in enumerate([-.11,-.055,0,.055,.11]):
    stroke('RaisedBinding'+str(k),[(math.cos(i*math.pi/24)*.0168,y,-.024-math.sin(i*math.pi/24)*.0168) for i in range(25)],.0015,gold,root)

def page(name,side,z,parent,mat=paper,shorten=0):
    verts=[];uv=[];faces=[]
    for j in range(9):
        v=j/8
        for i in range(25):
            u=i/24
            x=side*(.009+u*(.186-shorten))
            y=(v-.5)*(.266-shorten)
            # Bound gutter, lifted shoulder, relaxed outer edge.
            lift=.009*math.sin(math.pi*u)*math.exp(-u*.9)+.0015*u*u*math.cos(v*math.pi)
            verts.append((x,y,z+lift));uv.append((u if side>0 else 1-u,v))
    for j in range(8):
        for i in range(24):
            a=j*25+i
            face=(a,a+1,a+26,a+25)
            faces.append(face if side>0 else tuple(reversed(face)))
    ob=mesh(name,verts,faces,mat,parent,uv)
    return ob

for side,parent in [(-1,left),(1,right)]:
    for layer in range(10):
        page(('Left' if side<0 else 'Right')+'Gathering'+str(layer),side,-.014+layer*.0019,parent,edge if layer%3==0 else paper,(9-layer)*.0003)
page('PageLeft',-1,.006,left)
hinge=group('PageHinge',right)
page('PageRight',1,.006,hinge)
for i in range(3):
    leaf=group('TurningLeaf'+str(i),right)
    page('TurningSheet'+str(i),1,.007+i*.0004,leaf)

points=[]
for i in range(25):
    t=i/24
    points.append((.052+.014*math.sin(t*4),-.05-t*.14,.008-.04*t*t))
verts=[];faces=[]
for x,y,z in points: verts.extend([(x-.004,y,z),(x+.004,y,z)])
for i in range(24): faces.append((i*2,i*2+1,i*2+3,i*2+2))
mesh('SilkBookmark',verts,faces,ribbon_mat,right)
group('Aura',root); group('Halo',root)

# Preserve the existing legacy reading controls without displaying them in combat.
for name in ['Control_Next','Control_Prev','Control_Seal','SealRing','StampEmber','StampGale','StampTide','StampVeil','MoteEmber','MoteGale','MoteTide','MoteVeil']:
    slab(name,rounded(0,0,.008,.008,.002),-.023,.001,gold,root,.0001)

assert all(math.isfinite(v) for ob in scene.objects if ob.type=='MESH' for p in ob.data.vertices for v in p.co)
assert all(scene.objects.get(n) for n in ['PageLeft','PageRight','PageHinge','CoverLeft','CoverRight','TurningLeaf0','Spine'])
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'aether-codex.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_animations=False)
os.makedirs(os.path.join(ROOT,'art'),exist_ok=True)
for image in bpy.data.images:
    if image.source=='FILE': image.pack()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art','aether-codex.blend'))
print('CODEX_OK',sum(len(ob.data.polygons) for ob in scene.objects if ob.type=='MESH'),'polygons',len(scene.objects),'parts')
