"""
5-Story Apartment Building (Пятиэтажный многоквартирный жилой дом)
Procedural 3D Architectural Generator for Blender & Three.js Visualizer
Reference: Modern 5-story 3-section brick residential building (silicatbrick.ru)
Target Facade Material: Bricks026 (procedural brick texture target)
"""

import bpy
import bmesh
from mathutils import Vector, Matrix
import math
import os
import shutil

# -------------------------------------------------------------------------
# 1. PATHS SETUP
# -------------------------------------------------------------------------
MODEL_DIR = r"C:\IT Projects\VS Code\Brick1\models\five_story_building"
TEXTURES_DIR = MODEL_DIR

BLEND_OUT = os.path.join(MODEL_DIR, "building.blend")
GLTF_OUT = os.path.join(MODEL_DIR, "scene.gltf")
GLB_OUT = os.path.join(MODEL_DIR, "building.glb")
PREVIEW_OUT = os.path.join(MODEL_DIR, "preview.png")

ARTIFACT_DIR = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca"
PREVIEW_FULL = os.path.join(ARTIFACT_DIR, "five_story_full.png")
PREVIEW_ENTRANCE = os.path.join(ARTIFACT_DIR, "five_story_entrance.png")
PREVIEW_ROOF = os.path.join(ARTIFACT_DIR, "five_story_roof.png")

print(f"=== Starting 5-Story Apartment Building Generation ===")
print(f"Target Output: {GLTF_OUT}")

# -------------------------------------------------------------------------
# 2. SCENE RESET & ENVIRONMENT SETUP
# -------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

scene = bpy.context.scene
if "Collection" in bpy.data.collections:
    main_collection = bpy.data.collections["Collection"]
else:
    main_collection = bpy.data.collections.new("BuildingCollection")
    scene.collection.children.link(main_collection)

# Set world background color (pleasant soft sky blue matching Three.js visualizer)
world = bpy.data.worlds.new("World_Sky")
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs["Color"].default_value = (0.75, 0.83, 0.92, 1.0)
    bg_node.inputs["Strength"].default_value = 1.0
scene.world = world

# -------------------------------------------------------------------------
# 3. PBR MATERIALS SETUP
# -------------------------------------------------------------------------
def create_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                        tex_color_name=None, tex_norm_name=None, is_glass=False, alpha=1.0, transmission=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_out.location = (300, 0)
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (0, 0)
    links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])

    if 'Base Color' in node_bsdf.inputs:
        node_bsdf.inputs['Base Color'].default_value = base_color
    if 'Roughness' in node_bsdf.inputs:
        node_bsdf.inputs['Roughness'].default_value = roughness
    if 'Metallic' in node_bsdf.inputs:
        node_bsdf.inputs['Metallic'].default_value = metallic

    if is_glass:
        if 'Transmission Weight' in node_bsdf.inputs:
            node_bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in node_bsdf.inputs:
            node_bsdf.inputs['Transmission'].default_value = transmission
        if 'Alpha' in node_bsdf.inputs:
            node_bsdf.inputs['Alpha'].default_value = alpha
        if 'Roughness' in node_bsdf.inputs:
            node_bsdf.inputs['Roughness'].default_value = 0.05
        if 'IOR' in node_bsdf.inputs:
            node_bsdf.inputs['IOR'].default_value = 1.52
        mat.blend_method = 'BLEND'

    curr_x = -400
    if tex_color_name:
        tex_path = os.path.join(TEXTURES_DIR, tex_color_name)
        if os.path.exists(tex_path):
            img = bpy.data.images.load(tex_path)
            node_img = nodes.new(type='ShaderNodeTexImage')
            node_img.image = img
            node_img.location = (curr_x, 150)
            links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])
            curr_x -= 300

    if tex_norm_name:
        norm_path = os.path.join(TEXTURES_DIR, tex_norm_name)
        if os.path.exists(norm_path):
            norm_img = bpy.data.images.load(norm_path)
            norm_img.colorspace_settings.name = 'Non-Color'
            node_norm_img = nodes.new(type='ShaderNodeTexImage')
            node_norm_img.image = norm_img
            node_norm_img.location = (curr_x, -150)
            node_norm_map = nodes.new(type='ShaderNodeNormalMap')
            node_norm_map.location = (-150, -150)
            links.new(node_norm_img.outputs['Color'], node_norm_map.inputs['Color'])
            links.new(node_norm_map.outputs['Normal'], node_bsdf.inputs['Normal'])

    return mat

# Standard materials required by Three.js project
mat_brick = create_pbr_material(
    name="Bricks026",
    base_color=(0.84, 0.76, 0.60, 1.0), # Warm cream-buff silicate brick
    roughness=0.85,
    metallic=0.0,
    tex_color_name="Bricks026_baseColor.jpg",
    tex_norm_name="Bricks026_normal.png"
)

mat_concrete = create_pbr_material(
    name="Concrete05",
    base_color=(0.45, 0.42, 0.39, 1.0), # Foundation plinth concrete / architectural sills
    roughness=0.75,
    metallic=0.0,
    tex_color_name="Concrete05_baseColor.jpg",
    tex_norm_name="Concrete05_normal.png"
)

mat_roof = create_pbr_material(
    name="Roof01",
    base_color=(0.24, 0.25, 0.27, 1.0), # Flat roof gravel/membrane
    roughness=0.70,
    metallic=0.05,
    tex_color_name="Roof01_baseColor.jpg"
)

mat_wood = create_pbr_material(
    name="Wood01",
    base_color=(0.95, 0.95, 0.96, 1.0), # White architectural PVC window profiles & trims
    roughness=0.35,
    metallic=0.0,
    tex_color_name="Wood01_baseColor.jpg"
)

mat_glass = create_pbr_material(
    name="Translucent_Glass_Gray",
    base_color=(0.08, 0.12, 0.18, 0.90), # Deep reflective architectural glass
    roughness=0.05,
    metallic=0.90,
    transmission=0.15,
    alpha=0.90,
    is_glass=True
)

mat_metal = create_pbr_material(
    name="Metal",
    base_color=(0.18, 0.19, 0.21, 1.0), # Dark metallic steel for railings, doors, downspouts
    roughness=0.25,
    metallic=0.95
)

# -------------------------------------------------------------------------
# 4. GEOMETRIC BUILDER HELPERS (BMESH)
# -------------------------------------------------------------------------
bm_brick = bmesh.new()
bm_concrete = bmesh.new()
bm_roof = bmesh.new()
bm_wood = bmesh.new()
bm_glass = bmesh.new()
bm_metal = bmesh.new()

def add_box(bm, x0, x1, y0, y1, z0, z1):
    """Adds a quad-based axis-aligned box with outward facing normals."""
    x_min, x_max = min(x0, x1), max(x0, x1)
    y_min, y_max = min(y0, y1), max(y0, y1)
    z_min, z_max = min(z0, z1), max(z0, z1)

    v0 = bm.verts.new((x_min, y_min, z_min))
    v1 = bm.verts.new((x_max, y_min, z_min))
    v2 = bm.verts.new((x_max, y_max, z_min))
    v3 = bm.verts.new((x_min, y_max, z_min))
    v4 = bm.verts.new((x_min, y_min, z_max))
    v5 = bm.verts.new((x_max, y_min, z_max))
    v6 = bm.verts.new((x_max, y_max, z_max))
    v7 = bm.verts.new((x_min, y_max, z_max))

    bm.faces.new((v0, v3, v2, v1)) # Bottom
    bm.faces.new((v4, v5, v6, v7)) # Top
    bm.faces.new((v0, v1, v5, v4)) # Front (-Y)
    bm.faces.new((v2, v3, v7, v6)) # Back (+Y)
    bm.faces.new((v3, v0, v4, v7)) # Left (-X)
    bm.faces.new((v1, v2, v6, v5)) # Right (+X)

def add_pipe_segment(bm, x0, y0, z0, x1, y1, z1, radius=0.06, segments=10):
    """Creates a cylindrical pipe segment between two 3D points."""
    p0 = Vector((x0, y0, z0))
    p1 = Vector((x1, y1, z1))
    v_axis = p1 - p0
    length = v_axis.length
    if length < 1e-5:
        return
    z_unit = Vector((0, 0, 1))
    rot_q = z_unit.rotation_difference(v_axis.normalized())

    ring0 = []
    ring1 = []
    for i in range(segments):
        angle = 2.0 * math.pi * i / segments
        vx = radius * math.cos(angle)
        vy = radius * math.sin(angle)
        local_v0 = rot_q @ Vector((vx, vy, 0.0)) + p0
        local_v1 = rot_q @ Vector((vx, vy, 0.0)) + p1
        ring0.append(bm.verts.new(local_v0))
        ring1.append(bm.verts.new(local_v1))

    for i in range(segments):
        next_i = (i + 1) % segments
        bm.faces.new((ring0[i], ring0[next_i], ring1[next_i], ring1[i]))

# -------------------------------------------------------------------------
# 5. ARCHITECTURAL SPECIFICATION & DIMENSIONS
# -------------------------------------------------------------------------
L_HALF = 22.5   # Total building length = 45.0m
W_HALF = 6.5    # Total building depth = 13.0m

# Z-Levels
Z_GROUND = 0.0
Z_PLINTH = 0.90      # Height of semi-basement plinth
FLOOR_H = 2.80       # Height per residential floor (5 floors total)
Z_F1 = Z_PLINTH              # 0.90m
Z_F2 = Z_F1 + FLOOR_H        # 3.70m
Z_F3 = Z_F2 + FLOOR_H        # 6.50m
Z_F4 = Z_F3 + FLOOR_H        # 9.30m
Z_F5 = Z_F4 + FLOOR_H        # 12.10m
Z_WALL_TOP = Z_F5 + FLOOR_H  # 14.90m
Z_ROOF_SLAB = 15.10          # Recessed flat roof surface
Z_PARAPET = 16.10            # Top of brick parapet
Z_COPING = 16.20             # Parapet concrete capping
Z_PEDIMENT_PEAK = 17.65      # Peak of the 3 arched pediments

# Risalits (Entrance & Loggia volumes projecting forward on front facade)
RISALIT_X = [-13.0, 0.0, 13.0]  # Centers of the 3 sections (подъезды)
RISALIT_W = 3.8                  # Width of each risalit
RISALIT_PROJ = 0.65              # Forward projection from front wall
Y_FRONT_WALL = -W_HALF           # -6.50m
Y_RISALIT_FRONT = Y_FRONT_WALL - RISALIT_PROJ  # -7.15m

# Window axes along X for front facade (10 columns):
WINDOW_COLS_FRONT = [
    -20.0, -17.4,       # Left of Section 1 (2 columns)
    -8.8, -6.5, -4.2,   # Between Section 1 and 2 (3 columns)
    4.2, 6.5, 8.8,      # Between Section 2 and 3 (3 columns)
    17.4, 20.0          # Right of Section 3 (2 columns)
]

print("-> Building Main Footprint, Plinth & Exterior Walls...")

# -------------------------------------------------------------------------
# 6. FOUNDATION & PLINTH (Concrete05)
# -------------------------------------------------------------------------
# Main plinth band
add_box(bm_concrete, -L_HALF - 0.08, L_HALF + 0.08, -W_HALF - 0.08, W_HALF + 0.08, Z_GROUND, Z_PLINTH)

# Risalit plinth projections
for rx in RISALIT_X:
    add_box(bm_concrete, rx - RISALIT_W/2 - 0.08, rx + RISALIT_W/2 + 0.08,
            Y_FRONT_WALL, Y_RISALIT_FRONT - 0.08, Z_GROUND, Z_PLINTH)

# Concrete perimeter sidewalk / apron (отмостка)
add_box(bm_concrete, -L_HALF - 1.4, L_HALF + 1.4, -W_HALF - 2.2, W_HALF + 1.4, -0.05, 0.08)

# Plinth dividing belt cornice (тяга по верху цоколя)
add_box(bm_concrete, -L_HALF - 0.12, L_HALF + 0.12, -W_HALF - 0.12, W_HALF + 0.12, Z_PLINTH - 0.08, Z_PLINTH + 0.04)
for rx in RISALIT_X:
    add_box(bm_concrete, rx - RISALIT_W/2 - 0.12, rx + RISALIT_W/2 + 0.12,
            Y_FRONT_WALL, Y_RISALIT_FRONT - 0.12, Z_PLINTH - 0.08, Z_PLINTH + 0.04)

# -------------------------------------------------------------------------
# 7. MAIN FACADE WALLS & STRUCTURAL SHELL (Bricks026)
# -------------------------------------------------------------------------
# End walls (Left and Right - X min & X max)
add_box(bm_brick, -L_HALF - 0.02, -L_HALF + 0.40, -W_HALF, W_HALF, Z_PLINTH, Z_PARAPET)
add_box(bm_brick, L_HALF - 0.40, L_HALF + 0.02, -W_HALF, W_HALF, Z_PLINTH, Z_PARAPET)

# End wall belt cornices (decorative horizontal brick bands matching Russian brick architecture)
for belt_z in [Z_F2, Z_F4, Z_WALL_TOP]:
    add_box(bm_concrete, -L_HALF - 0.08, -L_HALF + 0.42, -W_HALF - 0.05, W_HALF + 0.05, belt_z - 0.06, belt_z + 0.06)
    add_box(bm_concrete, L_HALF - 0.42, L_HALF + 0.08, -W_HALF - 0.05, W_HALF + 0.05, belt_z - 0.06, belt_z + 0.06)

# Rear facade wall (Y = +W_HALF)
add_box(bm_brick, -L_HALF, L_HALF, W_HALF - 0.40, W_HALF + 0.02, Z_PLINTH, Z_PARAPET)

# Front Facade Wall - Built in panels to create exact window and door openings
openings_x = []
for wx in WINDOW_COLS_FRONT:
    openings_x.append((wx - 0.70, wx + 0.70, "window"))
for rx in RISALIT_X:
    openings_x.append((rx - RISALIT_W/2, rx + RISALIT_W/2, "risalit"))
openings_x.sort(key=lambda item: item[0])

# Construct solid piers between openings
curr_x = -L_HALF
for ox_min, ox_max, o_type in openings_x:
    if ox_min > curr_x + 0.02:
        add_box(bm_brick, curr_x, ox_min, Y_FRONT_WALL - 0.02, Y_FRONT_WALL + 0.38, Z_PLINTH, Z_PARAPET)
    curr_x = ox_max
if curr_x < L_HALF - 0.02:
    add_box(bm_brick, curr_x, L_HALF, Y_FRONT_WALL - 0.02, Y_FRONT_WALL + 0.38, Z_PLINTH, Z_PARAPET)

# Under-window and over-window spandrel walls for each front window column
WIN_W = 1.40
WIN_H = 1.55
WIN_SILL_OFFSET = 0.85 # Sill height from floor level

for wx in WINDOW_COLS_FRONT:
    x0 = wx - WIN_W/2
    x1 = wx + WIN_W/2

    for fl in range(5):
        fl_base = Z_F1 + fl * FLOOR_H
        z_sill = fl_base + WIN_SILL_OFFSET
        z_head = z_sill + WIN_H
        fl_ceil = fl_base + FLOOR_H

        # Spandrel wall below window
        add_box(bm_brick, x0, x1, Y_FRONT_WALL - 0.02, Y_FRONT_WALL + 0.38, fl_base, z_sill)

        # Lintel wall above window up to next floor
        add_box(bm_brick, x0, x1, Y_FRONT_WALL - 0.02, Y_FRONT_WALL + 0.38, z_head, fl_ceil)

    # Parapet above 5th floor
    add_box(bm_brick, x0, x1, Y_FRONT_WALL - 0.02, Y_FRONT_WALL + 0.38, Z_WALL_TOP, Z_PARAPET)

    # Basement window in plinth under each column
    add_box(bm_concrete, wx - 0.48, wx + 0.48, Y_FRONT_WALL - 0.12, Y_FRONT_WALL + 0.10, 0.20, 0.65)
    add_box(bm_metal, wx - 0.42, wx + 0.42, Y_FRONT_WALL - 0.08, Y_FRONT_WALL - 0.05, 0.25, 0.60)

# Parapet top coping cornice along main front wall and rear wall
add_box(bm_concrete, -L_HALF - 0.12, L_HALF + 0.12, Y_FRONT_WALL - 0.12, Y_FRONT_WALL + 0.42, Z_PARAPET, Z_COPING)
add_box(bm_concrete, -L_HALF - 0.12, L_HALF + 0.12, W_HALF - 0.42, W_HALF + 0.12, Z_PARAPET, Z_COPING)

print("-> Building Entrance Portals, Loggias & Smooth Arched Pediments...")

# -------------------------------------------------------------------------
# 8. RISALITS: ENTRANCES, LOGGIAS & ARCHED PEDIMENTS
# -------------------------------------------------------------------------
def add_smooth_arched_pediment(bm_b, bm_c, rx, rw, y0, y1, z_base, z_peak, segments=20):
    """
    Constructs a clean, smooth, curved arched pediment on top of each risalit.
    Creates quad vertical slices on front/back, curved top extrusion,
    and a continuous curved white concrete coping trim with central cross motif.
    """
    half_w = rw / 2.0
    rise = z_peak - z_base

    # Compute arc points
    arc_pts = []
    for i in range(segments + 1):
        t = i / segments
        angle = math.pi * (1.0 - t)
        px = rx + half_w * math.cos(angle)
        pz = z_base + rise * math.sin(angle)
        arc_pts.append((px, pz, angle))

    # Base vertices along z_base for clean quad columns
    front_base_verts = [bm_b.verts.new((px, y0, z_base)) for px, pz, _ in arc_pts]
    back_base_verts  = [bm_b.verts.new((px, y1, z_base)) for px, pz, _ in arc_pts]
    front_arc_verts  = [bm_b.verts.new((px, y0, pz)) for px, pz, _ in arc_pts]
    back_arc_verts   = [bm_b.verts.new((px, y1, pz)) for px, pz, _ in arc_pts]

    # Front & Back faces (clean quad strip!)
    for i in range(segments):
        bm_b.faces.new((front_base_verts[i], front_base_verts[i+1], front_arc_verts[i+1], front_arc_verts[i]))
        bm_b.faces.new((back_base_verts[i+1], back_base_verts[i], back_arc_verts[i], back_arc_verts[i+1]))

    # Curved top extrusion
    for i in range(segments):
        bm_b.faces.new((front_arc_verts[i], front_arc_verts[i+1], back_arc_verts[i+1], back_arc_verts[i]))

    # Concrete coping rim along the curved perimeter (all vertices created in bm_c!)
    coping_thick = 0.08
    c_outer_front = []
    c_outer_back = []
    c_inner_front = []
    c_inner_back = []
    for px, pz, angle in arc_pts:
        nx = math.cos(angle) * coping_thick
        nz = math.sin(angle) * coping_thick
        c_outer_front.append(bm_c.verts.new((px + nx, y0 - 0.04, pz + nz)))
        c_outer_back.append(bm_c.verts.new((px + nx, y1 + 0.04, pz + nz)))
        c_inner_front.append(bm_c.verts.new((px, y0 - 0.04, pz)))
        c_inner_back.append(bm_c.verts.new((px, y1 + 0.04, pz)))

    for i in range(segments):
        # Outer curved rim
        bm_c.faces.new((c_outer_front[i], c_outer_front[i+1], c_outer_back[i+1], c_outer_back[i]))
        # Front face trim
        bm_c.faces.new((c_inner_front[i], c_inner_front[i+1], c_outer_front[i+1], c_outer_front[i]))
        # Back face trim
        bm_c.faces.new((c_outer_back[i], c_outer_back[i+1], c_inner_back[i+1], c_inner_back[i]))

    # Central decorative brick cross / emblem motif
    add_box(bm_c, rx - 0.35, rx + 0.35, y0 - 0.04, y0 + 0.02, z_base + 0.35, z_base + 1.15)
    add_box(bm_c, rx - 0.75, rx + 0.75, y0 - 0.04, y0 + 0.02, z_base + 0.65, z_base + 0.85)

for rx in RISALIT_X:
    rw2 = RISALIT_W / 2.0
    x_left = rx - rw2
    x_right = rx + rw2

    # 1. Risalit Side Return Walls (connecting main wall Y=-6.5 to risalit front Y=-7.15)
    add_box(bm_brick, x_left - 0.02, x_left + 0.38, Y_FRONT_WALL, Y_RISALIT_FRONT, Z_PLINTH, Z_PARAPET)
    add_box(bm_brick, x_right - 0.38, x_right + 0.02, Y_FRONT_WALL, Y_RISALIT_FRONT, Z_PLINTH, Z_PARAPET)

    # Parapet coping on side return walls
    add_box(bm_concrete, x_left - 0.06, x_left + 0.42, Y_FRONT_WALL - 0.05, Y_RISALIT_FRONT + 0.05, Z_PARAPET, Z_COPING)
    add_box(bm_concrete, x_right - 0.42, x_right + 0.06, Y_FRONT_WALL - 0.05, Y_RISALIT_FRONT + 0.05, Z_PARAPET, Z_COPING)

    # 2. Ground Floor: Recessed Entrance Porch Niche
    add_box(bm_brick, x_left, rx - 1.25, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, Z_PLINTH, Z_F2)
    add_box(bm_brick, rx + 1.25, x_right, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, Z_PLINTH, Z_F2)

    # Concrete canopy beam above entrance niche
    add_box(bm_concrete, rx - 1.45, rx + 1.45, Y_RISALIT_FRONT - 0.45, Y_FRONT_WALL + 0.20, Z_F2 - 0.25, Z_F2)

    # Recessed back wall of porch niche where door sits
    add_box(bm_brick, rx - 1.30, rx + 1.30, Y_FRONT_WALL - 0.20, Y_FRONT_WALL + 0.20, Z_PLINTH, Z_F2)

    # Concrete Entrance Landing & Steps
    add_box(bm_concrete, rx - 1.40, rx + 1.40, Y_FRONT_WALL, Y_RISALIT_FRONT - 0.70, 0.0, 0.45)
    add_box(bm_concrete, rx - 1.30, rx + 1.30, Y_RISALIT_FRONT - 0.70, Y_RISALIT_FRONT - 1.00, 0.0, 0.30)
    add_box(bm_concrete, rx - 1.30, rx + 1.30, Y_RISALIT_FRONT - 1.00, Y_RISALIT_FRONT - 1.30, 0.0, 0.15)
    # Side cheek walls / curbs
    add_box(bm_concrete, rx - 1.55, rx - 1.40, Y_FRONT_WALL, Y_RISALIT_FRONT - 1.35, 0.0, 0.65)
    add_box(bm_concrete, rx + 1.40, rx + 1.55, Y_FRONT_WALL, Y_RISALIT_FRONT - 1.35, 0.0, 0.65)

    # Metal Handrail on side curbs
    add_pipe_segment(bm_metal, rx - 1.48, Y_RISALIT_FRONT - 1.20, 0.65, rx - 1.48, Y_RISALIT_FRONT - 1.20, 1.45, radius=0.025)
    add_pipe_segment(bm_metal, rx - 1.48, Y_RISALIT_FRONT - 0.20, 0.65, rx - 1.48, Y_RISALIT_FRONT - 0.20, 1.45, radius=0.025)
    add_pipe_segment(bm_metal, rx - 1.48, Y_RISALIT_FRONT - 1.20, 1.45, rx - 1.48, Y_RISALIT_FRONT - 0.20, 1.45, radius=0.03)

    add_pipe_segment(bm_metal, rx + 1.48, Y_RISALIT_FRONT - 1.20, 0.65, rx + 1.48, Y_RISALIT_FRONT - 1.20, 1.45, radius=0.025)
    add_pipe_segment(bm_metal, rx + 1.48, Y_RISALIT_FRONT - 0.20, 0.65, rx + 1.48, Y_RISALIT_FRONT - 0.20, 1.45, radius=0.025)
    add_pipe_segment(bm_metal, rx + 1.48, Y_RISALIT_FRONT - 1.20, 1.45, rx + 1.48, Y_RISALIT_FRONT - 0.20, 1.45, radius=0.03)

    # Metal Entrance Door (dark steel panel, clearly visible!)
    add_box(bm_metal, rx - 0.58, rx + 0.58, Y_FRONT_WALL - 0.24, Y_FRONT_WALL - 0.20, 0.45, 2.60)
    # White door frame trim / casing (surrounding the door, NOT covering it!)
    add_box(bm_wood, rx - 0.68, rx - 0.58, Y_FRONT_WALL - 0.25, Y_FRONT_WALL - 0.18, 0.45, 2.68) # left jamb
    add_box(bm_wood, rx + 0.58, rx + 0.68, Y_FRONT_WALL - 0.25, Y_FRONT_WALL - 0.18, 0.45, 2.68) # right jamb
    add_box(bm_wood, rx - 0.68, rx + 0.68, Y_FRONT_WALL - 0.25, Y_FRONT_WALL - 0.18, 2.60, 2.68) # top head
    # Door handle & intercom panel
    add_box(bm_metal, rx + 0.40, rx + 0.46, Y_FRONT_WALL - 0.28, Y_FRONT_WALL - 0.24, 1.35, 1.55) # Handle
    add_box(bm_metal, rx + 0.72, rx + 0.88, Y_FRONT_WALL - 0.24, Y_FRONT_WALL - 0.20, 1.40, 1.65) # Intercom

    # 3. Floors 2 to 5: Glazed Loggias (Лоджии)
    LOGGIA_W = 3.10
    BALUST_H = 0.95
    GLAZING_H = 1.65

    for fl in range(1, 5):
        fl_base = Z_F1 + fl * FLOOR_H
        z_balust_top = fl_base + BALUST_H
        z_glaz_top = z_balust_top + GLAZING_H
        fl_ceil = fl_base + FLOOR_H

        # Flanking edge piers of the loggia
        add_box(bm_brick, x_left, rx - LOGGIA_W/2, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, fl_base, fl_ceil)
        add_box(bm_brick, rx + LOGGIA_W/2, x_right, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, fl_base, fl_ceil)

        # Brick balustrade (парапет лоджии)
        add_box(bm_brick, rx - LOGGIA_W/2, rx + LOGGIA_W/2, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, fl_base, z_balust_top)

        # Concrete sill cap on balustrade
        add_box(bm_concrete, rx - LOGGIA_W/2 - 0.04, rx + LOGGIA_W/2 + 0.04, Y_RISALIT_FRONT - 0.08, Y_RISALIT_FRONT + 0.40, z_balust_top - 0.04, z_balust_top + 0.03)

        # Lintel beam above loggia
        add_box(bm_brick, rx - LOGGIA_W/2, rx + LOGGIA_W/2, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, z_glaz_top, fl_ceil)
        add_box(bm_concrete, rx - LOGGIA_W/2 - 0.04, rx + LOGGIA_W/2 + 0.04, Y_RISALIT_FRONT - 0.06, Y_RISALIT_FRONT + 0.40, fl_ceil - 0.08, fl_ceil)

        # Multi-sash White PVC Loggia Glazing (4 panes)
        lx0 = rx - LOGGIA_W/2 + 0.02
        lx1 = rx + LOGGIA_W/2 - 0.02
        ly = Y_RISALIT_FRONT + 0.12

        # Outer PVC frame
        add_box(bm_wood, lx0, lx1, ly - 0.04, ly + 0.04, z_balust_top + 0.03, z_balust_top + 0.09)
        add_box(bm_wood, lx0, lx1, ly - 0.04, ly + 0.04, z_glaz_top - 0.07, z_glaz_top)
        add_box(bm_wood, lx0, lx0 + 0.06, ly - 0.04, ly + 0.04, z_balust_top + 0.03, z_glaz_top)
        add_box(bm_wood, lx1 - 0.06, lx1, ly - 0.04, ly + 0.04, z_balust_top + 0.03, z_glaz_top)

        # 3 Vertical mullions dividing 4 equal sashes
        sash_w = (LOGGIA_W - 0.04) / 4.0
        for m_idx in range(1, 4):
            mx = lx0 + m_idx * sash_w
            add_box(bm_wood, mx - 0.03, mx + 0.03, ly - 0.04, ly + 0.04, z_balust_top + 0.03, z_glaz_top)

        # Horizontal transom rail in upper 1/4 of loggia
        z_transom = z_glaz_top - 0.40
        add_box(bm_wood, lx0, lx1, ly - 0.03, ly + 0.03, z_transom - 0.025, z_transom + 0.025)

        # Glass Panes for loggia
        add_box(bm_glass, lx0 + 0.04, lx1 - 0.04, ly - 0.01, ly + 0.01, z_balust_top + 0.06, z_glaz_top - 0.03)

    # 4. SOLID ATTIC WALL above 5th floor loggia (from Z=14.90m up to Z=16.10m)
    # Eliminates the hollow gap and creates a sturdy architectural base for the pediment!
    add_box(bm_brick, x_left, x_right, Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38, Z_WALL_TOP, Z_PARAPET)
    # Parapet cornice strip below pediment
    add_box(bm_concrete, x_left - 0.06, x_right + 0.06, Y_RISALIT_FRONT - 0.08, Y_RISALIT_FRONT + 0.40, Z_PARAPET - 0.08, Z_PARAPET)

    # 5. Smooth Arched Pediment on Top of Risalit (above Z=16.10m)
    add_smooth_arched_pediment(bm_brick, bm_concrete, rx, RISALIT_W,
                               Y_RISALIT_FRONT - 0.02, Y_RISALIT_FRONT + 0.38,
                               Z_PARAPET, Z_PEDIMENT_PEAK, segments=22)

# -------------------------------------------------------------------------
# 9. WINDOW ASSEMBLIES (Front Facade & Rear Facade)
# -------------------------------------------------------------------------
print("-> Building Detailed Windows & Architectural Trim...")

def add_standard_window(bm_w, bm_g, bm_c, wx, y_wall, z_sill, is_front=True):
    """Adds a realistic 2-sash PVC window with concrete sill and reflective glass."""
    y_sign = -1.0 if is_front else 1.0
    y_frame = y_wall + y_sign * 0.14
    w2 = WIN_W / 2.0
    x0 = wx - w2
    x1 = wx + w2
    z_head = z_sill + WIN_H

    # Concrete Window Sill (Отлив)
    sill_proj = y_wall + y_sign * 0.28
    y_sill_min = min(y_wall, sill_proj)
    y_sill_max = max(y_wall, sill_proj)
    add_box(bm_c, x0 - 0.06, x1 + 0.06, y_sill_min, y_sill_max, z_sill - 0.06, z_sill + 0.02)

    # White PVC Frame Perimeter
    add_box(bm_w, x0 + 0.02, x1 - 0.02, y_frame - 0.04, y_frame + 0.04, z_sill + 0.02, z_sill + 0.08) # bottom
    add_box(bm_w, x0 + 0.02, x1 - 0.02, y_frame - 0.04, y_frame + 0.04, z_head - 0.06, z_head)         # top
    add_box(bm_w, x0 + 0.02, x0 + 0.08, y_frame - 0.04, y_frame + 0.04, z_sill + 0.02, z_head)         # left
    add_box(bm_w, x1 - 0.08, x1 - 0.02, y_frame - 0.04, y_frame + 0.04, z_sill + 0.02, z_head)         # right

    # Central Vertical Mullion (импост) - divides into 2 equal sashes
    add_box(bm_w, wx - 0.03, wx + 0.03, y_frame - 0.04, y_frame + 0.04, z_sill + 0.02, z_head)

    # Upper horizontal transom bar
    z_tr = z_head - 0.42
    add_box(bm_w, x0 + 0.02, x1 - 0.02, y_frame - 0.03, y_frame + 0.03, z_tr - 0.025, z_tr + 0.025)

    # Glass Panes
    add_box(bm_g, x0 + 0.06, x1 - 0.06, y_frame - 0.01, y_frame + 0.01, z_sill + 0.06, z_head - 0.04)

# Build all Front Facade Windows (50 windows)
for wx in WINDOW_COLS_FRONT:
    for fl in range(5):
        fl_base = Z_F1 + fl * FLOOR_H
        z_sill = fl_base + WIN_SILL_OFFSET
        add_standard_window(bm_wood, bm_glass, bm_concrete, wx, Y_FRONT_WALL, z_sill, is_front=True)

# Build Rear Facade Windows (Apartment & Staircase Windows)
WINDOW_COLS_REAR = WINDOW_COLS_FRONT # 10 apartment columns
STAIRCASE_COLS_REAR = RISALIT_X     # 3 staircase columns aligned with entrances

for wx in WINDOW_COLS_REAR:
    for fl in range(5):
        fl_base = Z_F1 + fl * FLOOR_H
        z_sill = fl_base + WIN_SILL_OFFSET
        add_standard_window(bm_wood, bm_glass, bm_concrete, wx, W_HALF, z_sill, is_front=False)

# Staircase Landing Windows on Rear Facade
for sx in STAIRCASE_COLS_REAR:
    for fl in range(4):
        # Positioned between floor landings
        z_sill = Z_F1 + (fl + 0.5) * FLOOR_H
        add_standard_window(bm_wood, bm_glass, bm_concrete, sx, W_HALF, z_sill, is_front=False)

# -------------------------------------------------------------------------
# 10. BASEMENT ENTRANCE ANNEX (On Left End Wall X = -22.5m)
# -------------------------------------------------------------------------
print("-> Building Basement Entrance Annex on End Wall...")
annex_x0 = -L_HALF - 2.20
annex_x1 = -L_HALF
annex_y0 = -W_HALF
annex_y1 = -W_HALF + 3.80
z_roof_low = 1.10
z_roof_high = 2.65

# Annex concrete base
add_box(bm_concrete, annex_x0 - 0.05, annex_x1, annex_y0 - 0.05, annex_y1 + 0.05, Z_GROUND, 0.45)

# Annex brick side and end walls
add_box(bm_brick, annex_x0, annex_x0 + 0.30, annex_y0, annex_y1, 0.45, z_roof_low + 0.60)
add_box(bm_brick, annex_x0, annex_x1, annex_y1 - 0.30, annex_y1, 0.45, z_roof_high - 0.10)

# Annex sloped roof (Roof01)
v_r0 = bm_roof.verts.new((annex_x0 - 0.08, annex_y0 - 0.08, z_roof_low))
v_r1 = bm_roof.verts.new((annex_x1 + 0.05, annex_y0 - 0.08, z_roof_high))
v_r2 = bm_roof.verts.new((annex_x1 + 0.05, annex_y1 + 0.08, z_roof_high))
v_r3 = bm_roof.verts.new((annex_x0 - 0.08, annex_y1 + 0.08, z_roof_low))
bm_roof.faces.new((v_r0, v_r1, v_r2, v_r3))

# Sloped fascia / drip edge
add_box(bm_metal, annex_x0 - 0.10, annex_x0 - 0.06, annex_y0 - 0.10, annex_y1 + 0.10, z_roof_low - 0.06, z_roof_low + 0.04)

# Metal entrance door into basement annex
add_box(bm_metal, annex_x0 + 0.30, annex_x1 - 0.40, annex_y0 - 0.02, annex_y0 + 0.04, 0.45, 2.05)
add_box(bm_metal, annex_x0 + 0.45, annex_x0 + 0.52, annex_y0 - 0.06, annex_y0 - 0.02, 1.25, 1.35) # handle

# -------------------------------------------------------------------------
# 11. ROOF INFRASTRUCTURE (Roof01, Bricks026, Metal)
# -------------------------------------------------------------------------
print("-> Building Roof Membrane, Vent Shafts & Safety Railings...")

# Flat roof membrane surface
add_box(bm_roof, -L_HALF + 0.35, L_HALF - 0.35, -W_HALF + 0.35, W_HALF - 0.35, Z_ROOF_SLAB - 0.10, Z_ROOF_SLAB)

# 6 Rooftop Brick Ventilation Shafts (вентшахты)
VENT_POSITIONS = [
    (-16.0, -1.8), (-16.0, 1.8),
    (-2.0, -1.8),  (2.0, 1.8),
    (16.0, -1.8),  (16.0, 1.8)
]

for vx, vy in VENT_POSITIONS:
    vw, vd, vh = 1.30, 0.85, 1.60
    # Brick shaft body
    add_box(bm_brick, vx - vw/2, vx + vw/2, vy - vd/2, vy + vd/2, Z_ROOF_SLAB, Z_ROOF_SLAB + vh)
    # Concrete top cap
    add_box(bm_concrete, vx - vw/2 - 0.06, vx + vw/2 + 0.06, vy - vd/2 - 0.06, vy + vd/2 + 0.06,
            Z_ROOF_SLAB + vh, Z_ROOF_SLAB + vh + 0.08)
    # Metal rain hood (зонт-колпак) supported on 4 corner legs
    cap_z = Z_ROOF_SLAB + vh + 0.28
    add_box(bm_metal, vx - vw/2 - 0.10, vx + vw/2 + 0.10, vy - vd/2 - 0.10, vy + vd/2 + 0.10, cap_z, cap_z + 0.04)
    for lx in [vx - vw/2 + 0.08, vx + vw/2 - 0.08]:
        for ly in [vy - vd/2 + 0.08, vy + vd/2 - 0.08]:
            add_pipe_segment(bm_metal, lx, ly, Z_ROOF_SLAB + vh + 0.08, lx, ly, cap_z, radius=0.02)

# 3 Rooftop Access Superstructures (выходы на кровлю над лестничными клетками)
for rx in RISALIT_X:
    bx, by = rx, 2.5
    bw, bd, bh = 2.40, 2.10, 2.30
    # Brick booth
    add_box(bm_brick, bx - bw/2, bx + bw/2, by - bd/2, by + bd/2, Z_ROOF_SLAB, Z_ROOF_SLAB + bh)
    # Sloping roof on booth
    add_box(bm_roof, bx - bw/2 - 0.08, bx + bw/2 + 0.08, by - bd/2 - 0.08, by + bd/2 + 0.08,
            Z_ROOF_SLAB + bh, Z_ROOF_SLAB + bh + 0.12)
    # Metal maintenance door
    add_box(bm_metal, bx - 0.50, bx + 0.50, by - bd/2 - 0.02, by - bd/2 + 0.02, Z_ROOF_SLAB, Z_ROOF_SLAB + 2.0)

# Metal Perimeter Roof Safety Railing (Кровельное ограждение)
RAIL_H = 0.65
rail_z_top = Z_COPING + RAIL_H

def build_roof_railing(bm_m, x0, x1, y0, y1):
    """Builds continuous steel roof safety railing along a line segment."""
    p0 = Vector((x0, y0, Z_COPING))
    p1 = Vector((x1, y1, Z_COPING))
    seg_len = (p1 - p0).length
    num_posts = max(2, int(seg_len / 2.2) + 1)

    for i in range(num_posts):
        t = i / (num_posts - 1)
        pt = p0.lerp(p1, t)
        # Vertical post
        add_pipe_segment(bm_m, pt.x, pt.y, Z_COPING, pt.x, pt.y, rail_z_top, radius=0.02)

    # Top horizontal rail
    add_pipe_segment(bm_m, x0, y0, rail_z_top, x1, y1, rail_z_top, radius=0.025)
    # Middle horizontal rail
    add_pipe_segment(bm_m, x0, y0, Z_COPING + RAIL_H * 0.5, x1, y1, Z_COPING + RAIL_H * 0.5, radius=0.018)

# Railing on front parapet sections (between the arched pediments)
build_roof_railing(bm_metal, -L_HALF, RISALIT_X[0] - RISALIT_W/2, Y_FRONT_WALL + 0.15, Y_FRONT_WALL + 0.15)
build_roof_railing(bm_metal, RISALIT_X[0] + RISALIT_W/2, RISALIT_X[1] - RISALIT_W/2, Y_FRONT_WALL + 0.15, Y_FRONT_WALL + 0.15)
build_roof_railing(bm_metal, RISALIT_X[1] + RISALIT_W/2, RISALIT_X[2] - RISALIT_W/2, Y_FRONT_WALL + 0.15, Y_FRONT_WALL + 0.15)
build_roof_railing(bm_metal, RISALIT_X[2] + RISALIT_W/2, L_HALF, Y_FRONT_WALL + 0.15, Y_FRONT_WALL + 0.15)

# Railing on rear parapet (continuous)
build_roof_railing(bm_metal, -L_HALF, L_HALF, W_HALF - 0.15, W_HALF - 0.15)

# Railing on end walls
build_roof_railing(bm_metal, -L_HALF + 0.15, -L_HALF + 0.15, -W_HALF, W_HALF)
build_roof_railing(bm_metal, L_HALF - 0.15, L_HALF - 0.15, -W_HALF, W_HALF)

# -------------------------------------------------------------------------
# 12. DOWNSPOUT DRAINAGE SYSTEM (Metal)
# -------------------------------------------------------------------------
print("-> Building Drainage Downspout Pipes & Funnels...")

# 6 Downspouts on front facade flanking each of the 3 risalits
DOWNSPOUT_FRONT_X = []
for rx in RISALIT_X:
    DOWNSPOUT_FRONT_X.append(rx - RISALIT_W/2 - 0.22)
    DOWNSPOUT_FRONT_X.append(rx + RISALIT_W/2 + 0.22)

# Plus 4 corner downspouts
DOWNSPOUTS = []
for dx in DOWNSPOUT_FRONT_X:
    DOWNSPOUTS.append((dx, Y_FRONT_WALL - 0.15, -1.0))
DOWNSPOUTS.append((-L_HALF + 0.25, W_HALF + 0.15, 1.0))
DOWNSPOUTS.append((L_HALF - 0.25, W_HALF + 0.15, 1.0))

for dx, dy, y_dir in DOWNSPOUTS:
    # Drainage hopper / funnel at roofline
    add_box(bm_metal, dx - 0.15, dx + 0.15, dy - 0.15, dy + 0.15, Z_PARAPET - 0.40, Z_PARAPET)
    # Vertical pipe down to plinth
    add_pipe_segment(bm_metal, dx, dy, Z_PARAPET - 0.40, dx, dy, Z_PLINTH - 0.25, radius=0.055, segments=10)
    # Wall brackets at each floor
    for fl in range(1, 6):
        bz = Z_F1 + fl * FLOOR_H
        add_box(bm_metal, dx - 0.08, dx + 0.08, dy - 0.08, dy + 0.08, bz - 0.03, bz + 0.03)
    # Curved discharge boot near ground
    add_pipe_segment(bm_metal, dx, dy, Z_PLINTH - 0.25, dx, dy + y_dir * 0.25, 0.10, radius=0.055, segments=8)

# -------------------------------------------------------------------------
# 13. UV MAPPING & GEOMETRY OPTIMIZATION
# -------------------------------------------------------------------------
print("-> Generating Seamless World-Space Box UV Coordinates...")

def uv_box_map_bmesh(bm, scale=0.5):
    """
    Direct procedural box mapping with uniform world scale.
    Ensures horizontal brick courses, zero texture distortion,
    and perfect seamless alignment across all 5 floors and corners.
    """
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        norm = face.normal
        ax, ay, az = abs(norm.x), abs(norm.y), abs(norm.z)

        if ay >= ax and ay >= az:
            # North / South (+Y / -Y) Wall Facades
            sign = 1.0 if norm.y > 0 else -1.0
            for loop in face.loops:
                v = loop.vert.co
                u = v.x * sign * scale
                w = v.z * scale
                loop[uv_layer].uv = (u, w)
        elif ax > ay and ax >= az:
            # East / West (+X / -X) End Walls
            sign = 1.0 if norm.x > 0 else -1.0
            for loop in face.loops:
                v = loop.vert.co
                u = -v.y * sign * scale
                w = v.z * scale
                loop[uv_layer].uv = (u, w)
        else:
            # Horizontal Slabs (+Z / -Z)
            for loop in face.loops:
                v = loop.vert.co
                u = v.x * scale
                w = v.y * scale
                loop[uv_layer].uv = (u, w)

# Apply robust UV mappings
uv_box_map_bmesh(bm_brick, scale=0.5)      # Matches brick procedural canvas scaling perfectly
uv_box_map_bmesh(bm_concrete, scale=0.6)
uv_box_map_bmesh(bm_roof, scale=0.5)
uv_box_map_bmesh(bm_wood, scale=0.8)

# -------------------------------------------------------------------------
# 14. OBJECT CONSOLIDATION & SCENE GRAPH CREATION
# -------------------------------------------------------------------------
print("-> Consolidating Meshes into 6 Three.js Project Materials...")

mesh_configs = [
    ("Walls_Facade", bm_brick, mat_brick, True),
    ("Foundation_Cornices", bm_concrete, mat_concrete, True),
    ("Roof_Structure", bm_roof, mat_roof, True),
    ("Frames_And_Doors", bm_wood, mat_wood, True),
    ("Glazing_Panes", bm_glass, mat_glass, False),
    ("Metal_Details", bm_metal, mat_metal, False)
]

created_objects = []

for obj_name, bm, mat, has_custom_uv in mesh_configs:
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv_layer = bm.loops.layers.uv.verify()

    mesh_data = bpy.data.meshes.new(obj_name + "_Mesh")
    bm.to_mesh(mesh_data)
    bm.free()

    obj = bpy.data.objects.new(obj_name, mesh_data)
    obj.data.materials.append(mat)
    main_collection.objects.link(obj)
    created_objects.append(obj)

    # Use smart project only for glass and metal if needed
    if not has_custom_uv:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.01)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)

# Reset transforms and apply cleanly
bpy.ops.object.select_all(action='DESELECT')
for obj in created_objects:
    obj.select_set(True)
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)

bpy.context.view_layer.objects.active = created_objects[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

print("-> Verification of generated objects:")
for obj in created_objects:
    print(f"   * {obj.name}: {len(obj.data.vertices)} vertices, {len(obj.data.polygons)} polygons | Mat: {obj.data.materials[0].name}")

# -------------------------------------------------------------------------
# 15. EXPORT GLTF, GLB & BLEND
# -------------------------------------------------------------------------
print(f"-> Saving {BLEND_OUT}...")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

print(f"-> Exporting {GLTF_OUT} (Separate GLTF for Three.js)...")
bpy.ops.export_scene.gltf(
    filepath=GLTF_OUT,
    export_format='GLTF_SEPARATE',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)

print(f"-> Exporting {GLB_OUT} (Self-contained binary GLB)...")
bpy.ops.export_scene.gltf(
    filepath=GLB_OUT,
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)

# -------------------------------------------------------------------------
# 16. RENDER VERIFICATION PREVIEWS
# -------------------------------------------------------------------------
print("-> Setting up Render Camera & Lighting...")
cam_data = bpy.data.cameras.new('RenderCam')
cam_data.lens = 28 # Slightly wider architectural lens matching photo 1 perspective
cam_obj = bpy.data.objects.new('RenderCam', cam_data)
main_collection.objects.link(cam_obj)
scene.camera = cam_obj

# Sun Light (Sun angle matching photo 1 - bright summer sunlight from upper right)
sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.2
sun_data.color = (1.0, 0.98, 0.94)
sun_obj = bpy.data.objects.new('Sun', sun_data)
main_collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(48), math.radians(22), math.radians(-42))

# Fill Light (Skylight)
fill_data = bpy.data.lights.new('Fill', type='SUN')
fill_data.energy = 1.4
fill_data.color = (0.84, 0.91, 1.0)
fill_obj = bpy.data.objects.new('Fill', fill_data)
main_collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(35), math.radians(-45), math.radians(115))

# Ground plane for soft contact shadows and asphalt yard matching photo 1
bm_ground = bmesh.new()
add_box(bm_ground, -90, 90, -90, 90, -0.05, 0.0)
ground_mesh = bpy.data.meshes.new("Ground_Mesh")
bm_ground.to_mesh(ground_mesh)
bm_ground.free()
ground_obj = bpy.data.objects.new("Ground", ground_mesh)
ground_obj.data.materials.append(mat_concrete)
main_collection.objects.link(ground_obj)

# Render settings
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEENext') else 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'

# Render 1: Full building perspective matching reference photo angle (ground level eye perspective!)
print("-> Rendering Full Building View (Street Perspective)...")
cam_obj.location = (-32.0, -32.0, 6.5)
target_full = Vector((-2.0, -4.0, 9.0))
cam_obj.rotation_euler = (target_full - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_FULL

try:
    bpy.ops.render.render(write_still=True)
except Exception as e:
    print(f"Warning: EEVEE render failed ({e}), falling back to Cycles...")
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    bpy.ops.render.render(write_still=True)

# Also save to preview.png inside model folder
if os.path.exists(PREVIEW_FULL):
    shutil.copyfile(PREVIEW_FULL, PREVIEW_OUT)

# Render 2: Entrance & Loggia Risalit Closeup
print("-> Rendering Entrance & Loggia Closeup...")
cam_obj.location = (-13.0, -18.0, 4.5)
target_ent = Vector((-13.0, -7.0, 4.5))
cam_obj.rotation_euler = (target_ent - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_ENTRANCE
bpy.ops.render.render(write_still=True)

# Render 3: Arched Pediment & Roof Infrastructure Closeup
print("-> Rendering Arched Pediment & Roof Closeup...")
cam_obj.location = (-13.0, -18.0, 19.5)
target_roof = Vector((-13.0, -6.5, 16.5))
cam_obj.rotation_euler = (target_roof - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = PREVIEW_ROOF
bpy.ops.render.render(write_still=True)

print("=== 5-Story Apartment Building Generation Completed Successfully! ===")
