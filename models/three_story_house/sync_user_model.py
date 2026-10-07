import bpy
import os
import math
from mathutils import Vector

BASE_DIR = r"c:\IT Projects\VS Code\Brick1\models\three_story_house"
SOURCE_BLEND = os.path.join(BASE_DIR, "house — копия.blend")
MAIN_BLEND = os.path.join(BASE_DIR, "house.blend")
GLTF_OUT = os.path.join(BASE_DIR, "scene.gltf")
GLB_OUT = os.path.join(BASE_DIR, "house.glb")

PREVIEW_FULL = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\house_preview_full.png"
PREVIEW_ROOF = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\roof_preview.png"
PREVIEW_ENTRANCE = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\entrance_preview.png"

print(f"=== Opening user model from: {SOURCE_BLEND} ===")
bpy.ops.wm.open_mainfile(filepath=SOURCE_BLEND)

# Ensure object mode
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

# Verify objects & materials
print("--- Scene Objects ---")
mesh_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in mesh_objs:
    mats = [s.material.name for s in o.material_slots if s.material]
    print(f"  {o.name:25} | Faces: {len(o.data.polygons):5} | Materials: {mats}")

# Save as primary house.blend
print(f"-> Saving as main project file: {MAIN_BLEND}")
bpy.ops.wm.save_as_mainfile(filepath=MAIN_BLEND)

# Export scene.gltf
print(f"-> Exporting scene.gltf...")
bpy.ops.export_scene.gltf(
    filepath=GLTF_OUT,
    export_format='GLTF_SEPARATE',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)

# Export house.glb
print(f"-> Exporting house.glb...")
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)

# Render updated verification previews
print("-> Rendering verification previews...")
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEENext') else 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'

# Remove existing camera/lights if any to create fresh studio setup
for o in list(scene.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)

# Studio Lights
light_data = bpy.data.lights.new('Sun', type='SUN')
light_data.energy = 4.5
light_data.color = (1.0, 0.98, 0.94)
light_obj = bpy.data.objects.new('Sun', light_data)
scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(52), math.radians(24), math.radians(-38))

fill_data = bpy.data.lights.new('Fill', type='SUN')
fill_data.energy = 1.2
fill_data.color = (0.85, 0.92, 1.0)
fill_obj = bpy.data.objects.new('Fill', fill_data)
scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(30), math.radians(-50), math.radians(120))

# Camera
cam_data = bpy.data.cameras.new('RenderCam')
cam_data.lens = 38
cam_obj = bpy.data.objects.new('RenderCam', cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

# 1. Full view
cam_obj.location = (-19.0, -25.0, 13.5)
target_full = Vector((0.0, -1.0, 6.8))
cam_obj.rotation_euler = (target_full - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_FULL
bpy.ops.render.render(write_still=True)

# 2. Roof closeup
cam_obj.location = (-8.0, -13.0, 15.2)
target_roof = Vector((0.0, -2.0, 12.2))
cam_obj.rotation_euler = (target_roof - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_ROOF
bpy.ops.render.render(write_still=True)

# 3. Entrance closeup
cam_obj.location = (0.0, -12.0, 2.5)
target_ent = Vector((0.0, -5.6, 2.3))
cam_obj.rotation_euler = (target_ent - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_ENTRANCE
bpy.ops.render.render(write_still=True)

print("=== Synchronization and Export Complete Successfully! ===")
