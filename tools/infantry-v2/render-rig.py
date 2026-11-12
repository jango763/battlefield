import bpy,json,math,struct,os
from pathlib import Path
from mathutils import Vector
root=Path(__file__).parent
raw=(root/'german.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);blob=raw[28+n:]
textures={}
for m in g['materials']:
    tex=m.get('pbrMetallicRoughness',{}).get('baseColorTexture')
    if tex:
        img=g['images'][g['textures'][tex['index']]['source']];view=g['bufferViews'][img['bufferView']];p=root/('tex-'+str(tex['index'])+('.jpg' if img['mimeType']=='image/jpeg' else '.png'));p.write_bytes(blob[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);textures[m['name']]=str(p)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
states=json.loads((root/os.environ.get('SOLDIER_STATES','render-states.json')).read_text());mats={}
for si,state in enumerate(states):
  for mi,data in enumerate(state['meshes']):
    points=[(v[0]+si*2.0,-v[2],v[1]) for v in data['vertices']];idx=data['indices'];faces=[idx[i:i+3] for i in range(0,len(idx),3)]
    mesh=bpy.data.meshes.new('mesh');mesh.from_pydata(points,[],faces);mesh.update();obj=bpy.data.objects.new(state['state']+str(mi),mesh);bpy.context.collection.objects.link(obj)
    key=(data['material'] or str(data['color']))+str(data.get('uniformTint'))
    if key not in mats:
      mat=bpy.data.materials.new(key);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*data['color'],1);bs.inputs['Roughness'].default_value=.85
      if data['material'] in textures:
        image=bpy.data.images.load(textures[data['material']]);node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;links=mat.node_tree.links;nodes=mat.node_tree.nodes
        output=node.outputs['Color']
        if data.get('uniformTint'):
          lum=nodes.new('ShaderNodeRGBToBW');links.new(output,lum.inputs[0])
          sqrt=nodes.new('ShaderNodeMath');sqrt.operation='SQRT';links.new(lum.outputs[0],sqrt.inputs[0])
          bright=nodes.new('ShaderNodeMath');bright.operation='MULTIPLY_ADD';bright.inputs[1].default_value=.95;bright.inputs[2].default_value=.28;bright.use_clamp=True;links.new(sqrt.outputs[0],bright.inputs[0])
          tint=nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[1].default_value=(*data['uniformTint'],1);links.new(bright.outputs[0],tint.inputs[2])
          if data.get('uniformMask'):
            mask=nodes.new('ShaderNodeAttribute');mask.attribute_name='uniformMask'
            mix=nodes.new('ShaderNodeMixRGB');links.new(mask.outputs['Fac'],mix.inputs[0]);links.new(output,mix.inputs[1]);links.new(tint.outputs[0],mix.inputs[2]);output=mix.outputs[0]
          else:output=tint.outputs[0]
        links.new(output,bs.inputs['Base Color'])
      mats[key]=mat
    mesh.materials.append(mats[key])
    if data.get('uniformMask'):
      attr=mesh.attributes.new('uniformMask','FLOAT','POINT')
      for i,v in enumerate(data['uniformMask']):attr.data[i].value=v
    if data['uv']:
      uv=mesh.uv_layers.new(name='UVMap');coords=data['uv']
      for polygon in mesh.polygons:
        polygon.use_smooth=True
        for li in polygon.loop_indices:
          vi=mesh.loops[li].vertex_index;uv.data[li].uv=(coords[vi*2],1-coords[vi*2+1])
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.location.z=-.03;mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.18,.20,.17,1);ground.data.materials.append(mat)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.57,.65,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(1,-5,7));bpy.context.object.data.energy=650;bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(7,-14,8));camera=bpy.context.object;direction=Vector(((len(states)-1),0,1.25))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=max(9.5,len(states)*2.1);bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=1500;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(root/os.environ.get('SOLDIER_RENDER','rig-check.png'));scene.view_settings.view_transform='Standard';bpy.ops.render.render(write_still=True)
