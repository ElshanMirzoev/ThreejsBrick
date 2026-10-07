import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

print("=== Starting 3-Story Classical House Generator for Three.js ===")

# -------------------------------------------------------------------------
# 1. SETUP & PATHS
# -------------------------------------------------------------------------
BASE_DIR = r"c:\IT Projects\VS Code\Brick1\models\three_story_house"
TEXTURES_DIR = os.path.join(BASE_DIR, "textures")
BLEND_OUT = os.path.join(BASE_DIR, "house.blend")
GLTF_OUT = os.path.join(BASE_DIR, "scene.gltf")
GLB_OUT = os.path.join(BASE_DIR, "house.glb")
PREVIEW_OUT = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\house_preview_full.png"

os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(TEXTURES_DIR, exist_ok=True)
os.makedirs(os.path.dirname(PREVIEW_OUT), exist_ok=True)

# -------------------------------------------------------------------------
# 2. CLEANUP EXISTING BLENDER SCENE
# -------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

for c in bpy.data.collections:
    bpy.data.collections.remove(c)
for m in bpy.data.meshes:
    bpy.data.meshes.remove(m)
for mat in bpy.data.materials:
    bpy.data.materials.remove(mat)

house_collection = bpy.data.collections.new("ThreeStoryHouse")
bpy.context.scene.collection.children.link(house_collection)

# -------------------------------------------------------------------------
# 3. PBR MATERIALS SETUP
# -------------------------------------------------------------------------
def create_pbr_material(name, base_color=(0.8, 0.8, 0.8, 1.0), roughness=0.5, metallic=0.0,
                        transmission=0.0, alpha=1.0, is_glass=False,
                        tex_color_name=None, tex_norm_name=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_out.location = (400, 0)

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

mat_brick = create_pbr_material(
    name="Bricks026",
    base_color=(0.78, 0.42, 0.28, 1.0),
    roughness=0.85,
    metallic=0.0,
    tex_color_name="Bricks026_baseColor.jpeg",
    tex_norm_name="Bricks026_normal.png"
)

mat_concrete = create_pbr_material(
    name="Concrete05",
    base_color=(0.82, 0.80, 0.77, 1.0),
    roughness=0.75,
    metallic=0.0,
    tex_color_name="Concrete05_baseColor.jpeg",
    tex_norm_name="Concrete05_normal.png"
)

mat_roof = create_pbr_material(
    name="Roof01",
    base_color=(0.28, 0.29, 0.33, 1.0),
    roughness=0.6,
    metallic=0.05,
    tex_color_name="Roof01_baseColor.jpeg"
)

mat_wood = create_pbr_material(
    name="Wood01",
    base_color=(0.28, 0.18, 0.11, 1.0),
    roughness=0.5,
    metallic=0.0,
    tex_color_name="Wood01_baseColor.jpeg"
)

mat_glass = create_pbr_material(
    name="Translucent_Glass_Gray",
    base_color=(0.75, 0.82, 0.88, 0.35),
    roughness=0.05,
    metallic=0.05,
    transmission=0.9,
    alpha=0.35,
    is_glass=True
)

mat_metal = create_pbr_material(
    name="Metal",
    base_color=(0.18, 0.19, 0.20, 1.0),
    roughness=0.25,
    metallic=0.95
)

# -------------------------------------------------------------------------
# 4. GEOMETRY BUILDER ENGINE (BMESH)
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

    f_bottom = bm.faces.new((v0, v3, v2, v1))
    f_top    = bm.faces.new((v4, v5, v6, v7))
    f_front  = bm.faces.new((v0, v1, v5, v4)) # -Y face
    f_right  = bm.faces.new((v1, v2, v6, v5)) # +X face
    f_back   = bm.faces.new((v2, v3, v7, v6)) # +Y face
    f_left   = bm.faces.new((v3, v0, v4, v7)) # -X face
    return [v0, v1, v2, v3, v4, v5, v6, v7]

def add_cylinder(bm, cx, cy, z0, z1, radius, segments=16):
    """Adds a vertical cylinder along Z axis."""
    bot_verts = []
    top_verts = []
    for i in range(segments):
        theta = 2.0 * math.pi * i / segments
        vx = cx + radius * math.cos(theta)
        vy = cy + radius * math.sin(theta)
        bot_verts.append(bm.verts.new((vx, vy, z0)))
        top_verts.append(bm.verts.new((vx, vy, z1)))

    for i in range(segments):
        ni = (i + 1) % segments
        bm.faces.new((bot_verts[i], bot_verts[ni], top_verts[ni], top_verts[i]))

    bm.faces.new(list(reversed(bot_verts)))
    bm.faces.new(top_verts)

def add_pipe_segment(bm, x0, y0, z0, x1, y1, z1, radius, segments=12):
    """Adds a cylinder between any two 3D points."""
    p0 = Vector((x0, y0, z0))
    p1 = Vector((x1, y1, z1))
    vec = p1 - p0
    length = vec.length
    if length < 1e-5:
        return
    direction = vec.normalized()

    up = Vector((0, 0, 1)) if abs(direction.z) < 0.9 else Vector((0, 1, 0))
    right = direction.cross(up).normalized()
    actual_up = right.cross(direction).normalized()

    bot_verts = []
    top_verts = []
    for i in range(segments):
        theta = 2.0 * math.pi * i / segments
        radial = right * (radius * math.cos(theta)) + actual_up * (radius * math.sin(theta))
        bot_verts.append(bm.verts.new(p0 + radial))
        top_verts.append(bm.verts.new(p1 + radial))

    for i in range(segments):
        ni = (i + 1) % segments
        bm.faces.new((bot_verts[i], bot_verts[ni], top_verts[ni], top_verts[i]))
    bm.faces.new(list(reversed(bot_verts)))
    bm.faces.new(top_verts)

# -------------------------------------------------------------------------
# 5. ARCHITECTURAL SPECIFICATIONS
# -------------------------------------------------------------------------
HX_MIN, HX_MAX = -6.5, 6.5   # 13.0 m wide
HY_MIN, HY_MAX = -5.2, 5.2   # 10.4 m deep

RX_MIN, RX_MAX = -2.3, 2.3   # 4.6 m wide
RY_MIN, RY_MAX = -5.6, -5.2  # 0.4 m risalit projection forward

PX_MIN, PX_MAX = -2.3, 2.3   # 4.6 m wide
PY_MIN, PY_MAX = -7.4, -5.6  # 1.8 m porch projection

Z_GROUND = 0.0
Z_PLINTH_TOP = 0.75

Z_F1_BASE = 0.75
Z_F1_TOP = 3.95
Z_BELT1_TOP = 4.22

Z_F2_BASE = 4.22
Z_F2_TOP = 7.20
Z_BELT2_TOP = 7.47

Z_F3_BASE = 7.47
Z_F3_TOP = 10.45
Z_CORNICE_TOP = 10.90

Z_ROOF_RIDGE = 13.50

# -------------------------------------------------------------------------
# 6. PLINTH & FOUNDATION (Concrete05)
# -------------------------------------------------------------------------
print("-> Building Foundation & Plinth...")
add_box(bm_concrete, HX_MIN, HX_MAX, HY_MIN, HY_MAX, Z_GROUND, Z_PLINTH_TOP)
add_box(bm_concrete, RX_MIN, RX_MAX, RY_MIN, RY_MAX, Z_GROUND, Z_PLINTH_TOP)
add_box(bm_concrete, PX_MIN, PX_MAX, PY_MIN, PY_MAX, Z_GROUND, Z_PLINTH_TOP)
add_box(bm_concrete, -3.2, 3.2, HY_MAX, HY_MAX + 1.8, Z_GROUND, Z_PLINTH_TOP)

def add_perimeter_belt(bm, z0, z1, proj=0.08):
    add_box(bm, HX_MIN - proj, HX_MAX + proj, HY_MIN - proj, HY_MIN, z0, z1)
    add_box(bm, HX_MIN - proj, HX_MAX + proj, HY_MAX, HY_MAX + proj, z0, z1)
    add_box(bm, HX_MIN - proj, HX_MIN, HY_MIN - proj, HY_MAX + proj, z0, z1)
    add_box(bm, HX_MAX, HX_MAX + proj, HY_MIN - proj, HY_MAX + proj, z0, z1)
    add_box(bm, RX_MIN - proj, RX_MAX + proj, RY_MIN - proj, RY_MIN, z0, z1)
    add_box(bm, RX_MIN - proj, RX_MIN, RY_MIN - proj, RY_MAX, z0, z1)
    add_box(bm, RX_MAX, RX_MAX + proj, RY_MIN - proj, RY_MAX, z0, z1)

add_perimeter_belt(bm_concrete, Z_PLINTH_TOP - 0.08, Z_PLINTH_TOP + 0.04, proj=0.07)

num_steps = 4
step_h = Z_PLINTH_TOP / num_steps
step_run = 0.32
step_w_half = 1.9
for s in range(num_steps):
    sz0 = Z_GROUND
    sz1 = Z_PLINTH_TOP - s * step_h
    sy0 = PY_MIN - (s + 1) * step_run
    sy1 = PY_MIN - s * step_run
    add_box(bm_concrete, -step_w_half - s * 0.05, step_w_half + s * 0.05, sy0, sy1, sz0, sz1)

for s in range(num_steps):
    sz0 = Z_GROUND
    sz1 = Z_PLINTH_TOP - s * step_h
    sy0 = HY_MAX + 1.8 + s * step_run
    sy1 = HY_MAX + 1.8 + (s + 1) * step_run
    add_box(bm_concrete, -2.4, 2.4, sy0, sy1, sz0, sz1)

# -------------------------------------------------------------------------
# 7. BELT CORNICES & MAIN CROWN ENTABLATURE (Concrete05)
# -------------------------------------------------------------------------
print("-> Building Architectural Cornices...")
add_perimeter_belt(bm_concrete, Z_F1_TOP, Z_BELT1_TOP, proj=0.15)
add_perimeter_belt(bm_concrete, Z_F2_TOP, Z_BELT2_TOP, proj=0.14)
add_perimeter_belt(bm_concrete, Z_F3_TOP, Z_CORNICE_TOP, proj=0.38)

# -------------------------------------------------------------------------
# 8. RUSTICATED CORNER QUOINS (Concrete05)
# -------------------------------------------------------------------------
print("-> Building Corner Quoins...")
corners = [
    (HX_MIN, HY_MIN, -1, -1),
    (HX_MAX, HY_MIN,  1, -1),
    (HX_MIN, HY_MAX, -1,  1),
    (HX_MAX, HY_MAX,  1,  1)
]
quoin_h = 0.32
quoin_gap = 0.04
z_curr = Z_PLINTH_TOP + 0.06
idx = 0
while z_curr + quoin_h < Z_CORNICE_TOP:
    if (Z_F1_TOP - 0.1 < z_curr < Z_BELT1_TOP + 0.05) or (Z_F2_TOP - 0.1 < z_curr < Z_BELT2_TOP + 0.05):
        z_curr += quoin_h + quoin_gap
        idx += 1
        continue
    is_long = (idx % 2 == 0)
    len_x = 0.60 if is_long else 0.38
    len_y = 0.38 if is_long else 0.60
    proj = 0.04
    for cx, cy, sx, sy in corners:
        qx0 = cx if sx < 0 else cx - len_x
        qx1 = cx + len_x if sx < 0 else cx
        qy0 = cy if sy < 0 else cy - len_y
        qy1 = cy + len_y if sy < 0 else cy
        if sx < 0: qx0 -= proj
        else:      qx1 += proj
        if sy < 0: qy0 -= proj
        else:      qy1 += proj
        add_box(bm_concrete, qx0, qx1, qy0, qy1, z_curr, z_curr + quoin_h)
    z_curr += quoin_h + quoin_gap
    idx += 1

# -------------------------------------------------------------------------
# 9. PORCH COLUMNS & 2ND FLOOR BALCONY (Concrete05, Wood01, Metal)
# -------------------------------------------------------------------------
print("-> Building Porch Columns & Balcony...")
col_positions = [
    (PX_MIN + 0.35, PY_MIN + 0.35),
    (PX_MAX - 0.35, PY_MIN + 0.35),
    (PX_MIN + 0.35, RY_MIN - 0.05),
    (PX_MAX - 0.35, RY_MIN - 0.05),
]
for col_x, col_y in col_positions:
    add_box(bm_concrete, col_x - 0.30, col_x + 0.30, col_y - 0.30, col_y + 0.30, Z_PLINTH_TOP, Z_PLINTH_TOP + 0.45)
    add_box(bm_wood, col_x - 0.22, col_x + 0.22, col_y - 0.22, col_y + 0.22, Z_PLINTH_TOP + 0.45, Z_F1_TOP - 0.30)
    add_box(bm_concrete, col_x - 0.32, col_x + 0.32, col_y - 0.32, col_y + 0.32, Z_F1_TOP - 0.30, Z_F1_TOP)

add_box(bm_wood, PX_MIN, PX_MAX, PY_MIN, RY_MIN, Z_F1_TOP - 0.25, Z_F1_TOP)
add_box(bm_concrete, PX_MIN - 0.12, PX_MAX + 0.12, PY_MIN - 0.12, RY_MIN, Z_F1_TOP, Z_BELT1_TOP)

bracket_xs = [-2.1, -1.4, -0.7, 0.0, 0.7, 1.4, 2.1]
for bx in bracket_xs:
    add_box(bm_concrete, bx - 0.08, bx + 0.08, PY_MIN - 0.10, PY_MIN + 0.30, Z_F1_TOP - 0.22, Z_F1_TOP)

bal_z0 = Z_BELT1_TOP
bal_z1 = bal_z0 + 1.02
rail_thick = 0.06
post_coords = [
    (PX_MIN - 0.08, PY_MIN - 0.08),
    (PX_MAX + 0.08, PY_MIN - 0.08),
    (PX_MIN - 0.08, RY_MIN - 0.05),
    (PX_MAX + 0.08, RY_MIN - 0.05),
    (0.0, PY_MIN - 0.08)
]
for px, py in post_coords:
    add_box(bm_metal, px - 0.05, px + 0.05, py - 0.05, py + 0.05, bal_z0, bal_z1 + 0.05)

add_box(bm_metal, PX_MIN - 0.10, PX_MAX + 0.10, PY_MIN - 0.10, PY_MIN - 0.10 + rail_thick, bal_z1 - rail_thick, bal_z1)
add_box(bm_metal, PX_MIN - 0.10, PX_MIN - 0.10 + rail_thick, PY_MIN - 0.10, RY_MIN, bal_z1 - rail_thick, bal_z1)
add_box(bm_metal, PX_MAX + 0.10 - rail_thick, PX_MAX + 0.10, PY_MIN - 0.10, RY_MIN, bal_z1 - rail_thick, bal_z1)

add_box(bm_metal, PX_MIN - 0.08, PX_MAX + 0.08, PY_MIN - 0.08, PY_MIN - 0.08 + rail_thick, bal_z0 + 0.08, bal_z0 + 0.08 + rail_thick)
add_box(bm_metal, PX_MIN - 0.08, PX_MIN - 0.08 + rail_thick, PY_MIN - 0.08, RY_MIN, bal_z0 + 0.08, bal_z0 + 0.08 + rail_thick)
add_box(bm_metal, PX_MAX + 0.08 - rail_thick, PX_MAX + 0.08, PY_MIN - 0.08, RY_MIN, bal_z0 + 0.08, bal_z0 + 0.08 + rail_thick)

baluster_count_front = 24
for i in range(1, baluster_count_front):
    bx = (PX_MIN - 0.08) + i * ((PX_MAX - PX_MIN + 0.16) / baluster_count_front)
    add_pipe_segment(bm_metal, bx, PY_MIN - 0.05, bal_z0 + 0.08, bx, PY_MIN - 0.05, bal_z1 - rail_thick, radius=0.016, segments=8)

baluster_count_side = 10
for i in range(1, baluster_count_side):
    by = (PY_MIN - 0.08) + i * ((RY_MIN - PY_MIN + 0.08) / baluster_count_side)
    add_pipe_segment(bm_metal, PX_MIN - 0.05, by, bal_z0 + 0.08, PX_MIN - 0.05, by, bal_z1 - rail_thick, radius=0.016, segments=8)
    add_pipe_segment(bm_metal, PX_MAX + 0.05, by, bal_z0 + 0.08, PX_MAX + 0.05, by, bal_z1 - rail_thick, radius=0.016, segments=8)

# -------------------------------------------------------------------------
# 10. DOORS & WINDOWS COMPONENT BUILDERS
# -------------------------------------------------------------------------
print("-> Building Architectural Openings Engine...")

def build_window(cx, cy, cz, width, height, facing='-Y', has_pediment=False):
    half_w = width * 0.5
    half_h = height * 0.5
    sill_h = 0.14
    sill_proj = 0.16
    trim_w = 0.15
    trim_proj = 0.08
    frame_thick = 0.07
    glass_recess = 0.05

    if facing == '-Y':
        sx0 = cx - half_w - 0.12
        sx1 = cx + half_w + 0.12
        sy0 = cy - sill_proj
        sy1 = cy + 0.02
        sz0 = cz - half_h - sill_h
        sz1 = cz - half_h
        add_box(bm_concrete, sx0, sx1, sy0, sy1, sz0, sz1)
        add_box(bm_concrete, sx0 + 0.05, sx0 + 0.20, sy0 + 0.04, sy1, sz0 - 0.16, sz0)
        add_box(bm_concrete, sx1 - 0.20, sx1 - 0.05, sy0 + 0.04, sy1, sz0 - 0.16, sz0)

        add_box(bm_concrete, cx - half_w - trim_w, cx - half_w, cy - trim_proj, cy + 0.01, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx + half_w, cx + half_w + trim_w, cy - trim_proj, cy + 0.01, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx - half_w - trim_w - 0.04, cx + half_w + trim_w + 0.04, cy - trim_proj - 0.02, cy + 0.01, cz + half_h, cz + half_h + trim_w + 0.06)
        add_box(bm_concrete, cx - 0.12, cx + 0.12, cy - trim_proj - 0.05, cy + 0.01, cz + half_h - 0.04, cz + half_h + trim_w + 0.12)

        if has_pediment:
            ped_base_z = cz + half_h + trim_w + 0.06
            ped_apex_z = ped_base_z + 0.55
            ped_w_half = half_w + trim_w + 0.14
            v_bl = bm_concrete.verts.new((cx - ped_w_half, cy - trim_proj - 0.03, ped_base_z))
            v_br = bm_concrete.verts.new((cx + ped_w_half, cy - trim_proj - 0.03, ped_base_z))
            v_ap = bm_concrete.verts.new((cx, cy - trim_proj - 0.03, ped_apex_z))
            v_bl_b = bm_concrete.verts.new((cx - ped_w_half, cy + 0.01, ped_base_z))
            v_br_b = bm_concrete.verts.new((cx + ped_w_half, cy + 0.01, ped_base_z))
            v_ap_b = bm_concrete.verts.new((cx, cy + 0.01, ped_apex_z))
            bm_concrete.faces.new((v_bl, v_br, v_ap))
            bm_concrete.faces.new((v_bl_b, v_ap_b, v_br_b))
            bm_concrete.faces.new((v_bl, v_ap, v_ap_b, v_bl_b))
            bm_concrete.faces.new((v_br, v_br_b, v_ap_b, v_ap))
            bm_concrete.faces.new((v_bl, v_bl_b, v_br_b, v_br))

        fx0, fx1 = cx - half_w, cx + half_w
        fy0, fy1 = cy - 0.02, cy + 0.12
        fz0, fz1 = cz - half_h, cz + half_h
        add_box(bm_wood, fx0, fx0 + frame_thick, fy0, fy1, fz0, fz1)
        add_box(bm_wood, fx1 - frame_thick, fx1, fy0, fy1, fz0, fz1)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz0, fz0 + frame_thick)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz1 - frame_thick, fz1)
        add_box(bm_wood, cx - 0.03, cx + 0.03, fy0, fy1, fz0, fz1)
        transom_z = cz + half_h * 0.35
        add_box(bm_wood, fx0, fx1, fy0, fy1, transom_z - 0.03, transom_z + 0.03)

        gy = cy + glass_recess
        add_box(bm_glass, fx0 + frame_thick, cx - 0.03, gy, gy + 0.01, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, cx + 0.03, fx1 - frame_thick, gy, gy + 0.01, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, fx0 + frame_thick, cx - 0.03, gy, gy + 0.01, transom_z + 0.03, fz1 - frame_thick)
        add_box(bm_glass, cx + 0.03, fx1 - frame_thick, gy, gy + 0.01, transom_z + 0.03, fz1 - frame_thick)

    elif facing == '+Y':
        sx0 = cx - half_w - 0.12
        sx1 = cx + half_w + 0.12
        sy0 = cy - 0.02
        sy1 = cy + sill_proj
        sz0 = cz - half_h - sill_h
        sz1 = cz - half_h
        add_box(bm_concrete, sx0, sx1, sy0, sy1, sz0, sz1)
        add_box(bm_concrete, cx - half_w - trim_w, cx - half_w, cy - 0.01, cy + trim_proj, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx + half_w, cx + half_w + trim_w, cy - 0.01, cy + trim_proj, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx - half_w - trim_w - 0.04, cx + half_w + trim_w + 0.04, cy - 0.01, cy + trim_proj + 0.02, cz + half_h, cz + half_h + trim_w + 0.06)

        fx0, fx1 = cx - half_w, cx + half_w
        fy0, fy1 = cy - 0.12, cy + 0.02
        fz0, fz1 = cz - half_h, cz + half_h
        add_box(bm_wood, fx0, fx0 + frame_thick, fy0, fy1, fz0, fz1)
        add_box(bm_wood, fx1 - frame_thick, fx1, fy0, fy1, fz0, fz1)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz0, fz0 + frame_thick)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz1 - frame_thick, fz1)
        add_box(bm_wood, cx - 0.03, cx + 0.03, fy0, fy1, fz0, fz1)
        transom_z = cz + half_h * 0.35
        add_box(bm_wood, fx0, fx1, fy0, fy1, transom_z - 0.03, transom_z + 0.03)

        gy = cy - glass_recess
        add_box(bm_glass, fx0 + frame_thick, cx - 0.03, gy, gy + 0.01, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, cx + 0.03, fx1 - frame_thick, gy, gy + 0.01, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, fx0 + frame_thick, cx - 0.03, gy, gy + 0.01, transom_z + 0.03, fz1 - frame_thick)
        add_box(bm_glass, cx + 0.03, fx1 - frame_thick, gy, gy + 0.01, transom_z + 0.03, fz1 - frame_thick)

    elif facing in ('-X', '+X'):
        sign = -1 if facing == '-X' else 1
        sy0 = cy - half_w - 0.12
        sy1 = cy + half_w + 0.12
        sx0 = cx - sill_proj if sign < 0 else cx - 0.02
        sx1 = cx + 0.02 if sign < 0 else cx + sill_proj
        sz0 = cz - half_h - sill_h
        sz1 = cz - half_h
        add_box(bm_concrete, sx0, sx1, sy0, sy1, sz0, sz1)

        add_box(bm_concrete, cx - trim_proj if sign < 0 else cx - 0.01, cx + 0.01 if sign < 0 else cx + trim_proj, cy - half_w - trim_w, cy - half_w, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx - trim_proj if sign < 0 else cx - 0.01, cx + 0.01 if sign < 0 else cx + trim_proj, cy + half_w, cy + half_w + trim_w, cz - half_h, cz + half_h + trim_w)
        add_box(bm_concrete, cx - trim_proj - 0.02 if sign < 0 else cx - 0.01, cx + 0.01 if sign < 0 else cx + trim_proj + 0.02, cy - half_w - trim_w - 0.04, cy + half_w + trim_w + 0.04, cz + half_h, cz + half_h + trim_w + 0.06)

        fy0, fy1 = cy - half_w, cy + half_w
        fx0 = cx - 0.02 if sign < 0 else cx - 0.12
        fx1 = cx + 0.12 if sign < 0 else cx + 0.02
        fz0, fz1 = cz - half_h, cz + half_h
        add_box(bm_wood, fx0, fx1, fy0, fy0 + frame_thick, fz0, fz1)
        add_box(bm_wood, fx0, fx1, fy1 - frame_thick, fy1, fz0, fz1)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz0, fz0 + frame_thick)
        add_box(bm_wood, fx0, fx1, fy0, fy1, fz1 - frame_thick, fz1)
        add_box(bm_wood, fx0, fx1, cy - 0.03, cy + 0.03, fz0, fz1)
        transom_z = cz + half_h * 0.35
        add_box(bm_wood, fx0, fx1, fy0, fy1, transom_z - 0.03, transom_z + 0.03)

        gx = cx - glass_recess if sign < 0 else cx + glass_recess
        add_box(bm_glass, gx, gx + 0.01, fy0 + frame_thick, cy - 0.03, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, gx, gx + 0.01, cy + 0.03, fy1 - frame_thick, fz0 + frame_thick, transom_z - 0.03)
        add_box(bm_glass, gx, gx + 0.01, fy0 + frame_thick, cy - 0.03, transom_z + 0.03, fz1 - frame_thick)
        add_box(bm_glass, gx, gx + 0.01, cy + 0.03, fy1 - frame_thick, transom_z + 0.03, fz1 - frame_thick)

def build_front_entrance(cx, cy, cz, width=2.4, height=3.1):
    half_w = width * 0.5
    trim_w = 0.22
    trim_proj = 0.12
    add_box(bm_concrete, cx - half_w - trim_w, cx - half_w, cy - trim_proj, cy + 0.02, cz, cz + height + trim_w)
    add_box(bm_concrete, cx + half_w, cx + half_w + trim_w, cy - trim_proj, cy + 0.02, cz, cz + height + trim_w)
    add_box(bm_concrete, cx - half_w - trim_w - 0.05, cx + half_w + trim_w + 0.05, cy - trim_proj - 0.04, cy + 0.02, cz + height, cz + height + trim_w + 0.10)
    add_box(bm_concrete, cx - half_w - trim_w - 0.08, cx + half_w + trim_w + 0.08, cy - trim_proj - 0.08, cy + 0.02, cz + height + trim_w + 0.08, cz + height + trim_w + 0.22)

    door_h = 2.35
    add_box(bm_wood, cx - half_w, cx + half_w, cy - 0.02, cy + 0.15, cz, cz + height)
    add_box(bm_wood, cx - half_w + 0.06, cx - 0.01, cy - 0.01, cy + 0.08, cz + 0.04, cz + door_h)
    add_box(bm_wood, cx + 0.01, cx + half_w - 0.06, cy - 0.01, cy + 0.08, cz + 0.04, cz + door_h)

    for leaf_cx in [cx - half_w * 0.5, cx + half_w * 0.5]:
        pw = 0.36
        add_box(bm_wood, leaf_cx - pw, leaf_cx + pw, cy - 0.025, cy + 0.01, cz + 0.15, cz + 0.85)
        add_box(bm_wood, leaf_cx - pw, leaf_cx + pw, cy - 0.025, cy + 0.01, cz + 1.05, cz + door_h - 0.15)

    add_box(bm_wood, cx - half_w + 0.06, cx + half_w - 0.06, cy, cy + 0.06, cz + door_h, cz + door_h + 0.06)
    add_box(bm_glass, cx - half_w + 0.08, cx + half_w - 0.08, cy + 0.02, cy + 0.03, cz + door_h + 0.06, cz + height - 0.06)
    for i in [-0.5, 0.0, 0.5]:
        add_box(bm_wood, cx + i - 0.02, cx + i + 0.02, cy + 0.01, cy + 0.04, cz + door_h + 0.06, cz + height - 0.06)

    for hx in [cx - 0.08, cx + 0.08]:
        add_box(bm_metal, hx - 0.02, hx + 0.02, cy - 0.04, cy, cz + 1.0, cz + 1.25)
        add_box(bm_metal, hx - 0.06 if hx < cx else hx + 0.02, hx - 0.02 if hx < cx else hx + 0.06, cy - 0.07, cy - 0.03, cz + 1.10, cz + 1.14)

def build_french_door(cx, cy, cz, width=2.1, height=2.6, facing='-Y'):
    half_w = width * 0.5
    trim_w = 0.14
    trim_proj = 0.08
    stile_w = 0.11
    bottom_rail_h = 0.38
    top_rail_h = 0.12

    if facing == '-Y':
        # Concrete surround & lintel
        add_box(bm_concrete, cx - half_w - trim_w, cx - half_w, cy - trim_proj, cy + 0.02, cz, cz + height + trim_w)
        add_box(bm_concrete, cx + half_w, cx + half_w + trim_w, cy - trim_proj, cy + 0.02, cz, cz + height + trim_w)
        add_box(bm_concrete, cx - half_w - trim_w - 0.04, cx + half_w + trim_w + 0.04, cy - trim_proj - 0.03, cy + 0.02, cz + height, cz + height + trim_w + 0.08)
        add_box(bm_concrete, cx - half_w - trim_w - 0.08, cx + half_w + trim_w + 0.08, cy - trim_proj - 0.06, cy + 0.02, cz + height + trim_w + 0.08, cz + height + trim_w + 0.20)

        # Left Door Leaf
        lx0, lx1 = cx - half_w, cx - 0.01
        add_box(bm_wood, lx0, lx0 + stile_w, cy - 0.02, cy + 0.08, cz, cz + height)
        add_box(bm_wood, lx1 - stile_w, lx1, cy - 0.02, cy + 0.08, cz, cz + height)
        add_box(bm_wood, lx0, lx1, cy - 0.02, cy + 0.08, cz, cz + bottom_rail_h)
        add_box(bm_wood, lx0, lx1, cy - 0.02, cy + 0.08, cz + height - top_rail_h, cz + height)
        add_box(bm_glass, lx0 + stile_w, lx1 - stile_w, cy + 0.02, cy + 0.03, cz + bottom_rail_h, cz + height - top_rail_h)
        for mz in [cz + 0.95, cz + 1.50, cz + 2.05]:
            add_box(bm_wood, lx0 + stile_w, lx1 - stile_w, cy - 0.01, cy + 0.05, mz - 0.025, mz + 0.025)
        add_box(bm_metal, lx1 - 0.06, lx1 - 0.02, cy - 0.05, cy - 0.02, cz + 1.05, cz + 1.15)

        # Right Door Leaf
        rx0, rx1 = cx + 0.01, cx + half_w
        add_box(bm_wood, rx0, rx0 + stile_w, cy - 0.02, cy + 0.08, cz, cz + height)
        add_box(bm_wood, rx1 - stile_w, rx1, cy - 0.02, cy + 0.08, cz, cz + height)
        add_box(bm_wood, rx0, rx1, cy - 0.02, cy + 0.08, cz, cz + bottom_rail_h)
        add_box(bm_wood, rx0, rx1, cy - 0.02, cy + 0.08, cz + height - top_rail_h, cz + height)
        add_box(bm_glass, rx0 + stile_w, rx1 - stile_w, cy + 0.02, cy + 0.03, cz + bottom_rail_h, cz + height - top_rail_h)
        for mz in [cz + 0.95, cz + 1.50, cz + 2.05]:
            add_box(bm_wood, rx0 + stile_w, rx1 - stile_w, cy - 0.01, cy + 0.05, mz - 0.025, mz + 0.025)
        add_box(bm_metal, rx0 + 0.02, rx0 + 0.06, cy - 0.05, cy - 0.02, cz + 1.05, cz + 1.15)

    elif facing == '+Y':
        add_box(bm_concrete, cx - half_w - trim_w, cx - half_w, cy - 0.02, cy + trim_proj, cz, cz + height + trim_w)
        add_box(bm_concrete, cx + half_w, cx + half_w + trim_w, cy - 0.02, cy + trim_proj, cz, cz + height + trim_w)
        add_box(bm_concrete, cx - half_w - trim_w - 0.04, cx + half_w + trim_w + 0.04, cy - 0.02, cy + trim_proj + 0.03, cz + height, cz + height + trim_w + 0.08)

        lx0, lx1 = cx - half_w, cx - 0.01
        add_box(bm_wood, lx0, lx0 + stile_w, cy - 0.08, cy + 0.02, cz, cz + height)
        add_box(bm_wood, lx1 - stile_w, lx1, cy - 0.08, cy + 0.02, cz, cz + height)
        add_box(bm_wood, lx0, lx1, cy - 0.08, cy + 0.02, cz, cz + bottom_rail_h)
        add_box(bm_wood, lx0, lx1, cy - 0.08, cy + 0.02, cz + height - top_rail_h, cz + height)
        add_box(bm_glass, lx0 + stile_w, lx1 - stile_w, cy - 0.03, cy - 0.02, cz + bottom_rail_h, cz + height - top_rail_h)
        for mz in [cz + 0.95, cz + 1.50, cz + 2.05]:
            add_box(bm_wood, lx0 + stile_w, lx1 - stile_w, cy - 0.05, cy + 0.01, mz - 0.025, mz + 0.025)

        rx0, rx1 = cx + 0.01, cx + half_w
        add_box(bm_wood, rx0, rx0 + stile_w, cy - 0.08, cy + 0.02, cz, cz + height)
        add_box(bm_wood, rx1 - stile_w, rx1, cy - 0.08, cy + 0.02, cz, cz + height)
        add_box(bm_wood, rx0, rx1, cy - 0.08, cy + 0.02, cz, cz + bottom_rail_h)
        add_box(bm_wood, rx0, rx1, cy - 0.08, cy + 0.02, cz + height - top_rail_h, cz + height)
        add_box(bm_glass, rx0 + stile_w, rx1 - stile_w, cy - 0.03, cy - 0.02, cz + bottom_rail_h, cz + height - top_rail_h)
        for mz in [cz + 0.95, cz + 1.50, cz + 2.05]:
            add_box(bm_wood, rx0 + stile_w, rx1 - stile_w, cy - 0.05, cy + 0.01, mz - 0.025, mz + 0.025)

# -------------------------------------------------------------------------
# 11. FACADE BRICK WALLS (Bricks026)
# -------------------------------------------------------------------------
print("-> Building Facade Brick Walls (Bricks026)...")

def build_facade_wall_with_openings(z_base, z_top, openings_front, openings_back, openings_left, openings_right):
    wall_thick = 0.28
    y_front = HY_MIN
    x_min = HX_MIN
    x_max = HX_MAX

    sorted_ops = sorted(openings_front, key=lambda o: o[0])
    cur_x = x_min
    for cx, cz, w, h in sorted_ops:
        half_w = w * 0.5
        half_h = h * 0.5
        x0 = cx - half_w
        x1 = cx + half_w
        z0 = cz - half_h
        z1 = cz + half_h

        if x0 > cur_x:
            add_box(bm_brick, cur_x, x0, y_front, y_front + wall_thick, z_base, z_top)
        if z0 > z_base:
            add_box(bm_brick, x0, x1, y_front, y_front + wall_thick, z_base, z0)
        if z1 < z_top:
            add_box(bm_brick, x0, x1, y_front, y_front + wall_thick, z1, z_top)
        cur_x = x1

    if cur_x < x_max:
        add_box(bm_brick, cur_x, x_max, y_front, y_front + wall_thick, z_base, z_top)

    cur_x = HX_MIN
    sorted_back = sorted(openings_back, key=lambda o: o[0])
    for cx, cz, w, h in sorted_back:
        half_w = w * 0.5
        half_h = h * 0.5
        x0 = cx - half_w
        x1 = cx + half_w
        z0 = cz - half_h
        z1 = cz + half_h

        if x0 > cur_x:
            add_box(bm_brick, cur_x, x0, HY_MAX - wall_thick, HY_MAX, z_base, z_top)
        if z0 > z_base:
            add_box(bm_brick, x0, x1, HY_MAX - wall_thick, HY_MAX, z_base, z0)
        if z1 < z_top:
            add_box(bm_brick, x0, x1, HY_MAX - wall_thick, HY_MAX, z1, z_top)
        cur_x = x1
    if cur_x < HX_MAX:
        add_box(bm_brick, cur_x, HX_MAX, HY_MAX - wall_thick, HY_MAX, z_base, z_top)

    cur_y = HY_MIN
    sorted_left = sorted(openings_left, key=lambda o: o[0])
    for cy, cz, w, h in sorted_left:
        half_w = w * 0.5
        half_h = h * 0.5
        y0 = cy - half_w
        y1 = cy + half_w
        z0 = cz - half_h
        z1 = cz + half_h

        if y0 > cur_y:
            add_box(bm_brick, HX_MIN, HX_MIN + wall_thick, cur_y, y0, z_base, z_top)
        if z0 > z_base:
            add_box(bm_brick, HX_MIN, HX_MIN + wall_thick, y0, y1, z_base, z0)
        if z1 < z_top:
            add_box(bm_brick, HX_MIN, HX_MIN + wall_thick, y0, y1, z1, z_top)
        cur_y = y1
    if cur_y < HY_MAX:
        add_box(bm_brick, HX_MIN, HX_MIN + wall_thick, cur_y, HY_MAX, z_base, z_top)

    cur_y = HY_MIN
    sorted_right = sorted(openings_right, key=lambda o: o[0])
    for cy, cz, w, h in sorted_right:
        half_w = w * 0.5
        half_h = h * 0.5
        y0 = cy - half_w
        y1 = cy + half_w
        z0 = cz - half_h
        z1 = cz + half_h

        if y0 > cur_y:
            add_box(bm_brick, HX_MAX - wall_thick, HX_MAX, cur_y, y0, z_base, z_top)
        if z0 > z_base:
            add_box(bm_brick, HX_MAX - wall_thick, HX_MAX, y0, y1, z_base, z0)
        if z1 < z_top:
            add_box(bm_brick, HX_MAX - wall_thick, HX_MAX, y0, y1, z1, z_top)
        cur_y = y1
    if cur_y < HY_MAX:
        add_box(bm_brick, HX_MAX - wall_thick, HX_MAX, cur_y, HY_MAX, z_base, z_top)

def build_risalit(z_base, z_top, openings_front):
    """Builds the central risalit (bay projection / ризалит) in bm_brick with Bricks026."""
    wall_thick = 0.28
    y_front = RY_MIN
    x_min = RX_MIN
    x_max = RX_MAX

    sorted_ops = sorted(openings_front, key=lambda o: o[0])
    cur_x = x_min
    for cx, cz, w, h in sorted_ops:
        half_w = w * 0.5
        half_h = h * 0.5
        x0 = cx - half_w
        x1 = cx + half_w
        z0 = cz - half_h
        z1 = cz + half_h

        if x0 > cur_x:
            add_box(bm_brick, cur_x, x0, y_front, y_front + wall_thick, z_base, z_top)
        if z0 > z_base:
            add_box(bm_brick, x0, x1, y_front, y_front + wall_thick, z_base, z0)
        if z1 < z_top:
            add_box(bm_brick, x0, x1, y_front, y_front + wall_thick, z1, z_top)
        cur_x = x1

    if cur_x < x_max:
        add_box(bm_brick, cur_x, x_max, y_front, y_front + wall_thick, z_base, z_top)

    # Side walls (cheeks) of risalit connecting back to facade
    add_box(bm_brick, RX_MIN, RX_MIN + wall_thick, RY_MIN, HY_MIN, z_base, z_top)
    add_box(bm_brick, RX_MAX - wall_thick, RX_MAX, RY_MIN, HY_MIN, z_base, z_top)

# === FLOOR 1 ===
ops_f1_front_main = [
    (-4.5, 2.35, 1.7, 2.2),
    ( 4.5, 2.35, 1.7, 2.2),
]
ops_f1_front_risalit = [
    (0.0, 2.30, 2.4, 3.1)
]
ops_f1_back = [
    (-4.5, 2.35, 1.7, 2.2),
    ( 0.0, 2.05, 2.4, 2.6),
    ( 4.5, 2.35, 1.7, 2.2),
]
ops_f1_sides = [
    (-2.2, 2.35, 1.6, 2.2),
    ( 2.2, 2.35, 1.6, 2.2)
]

build_facade_wall_with_openings(Z_F1_BASE, Z_F1_TOP, ops_f1_front_main, ops_f1_back, ops_f1_sides, ops_f1_sides)
build_risalit(Z_F1_BASE, Z_F1_TOP, ops_f1_front_risalit)

build_front_entrance(0.0, RY_MIN, Z_F1_BASE, width=2.4, height=3.1)
build_window(-4.5, HY_MIN, 2.35, 1.7, 2.2, facing='-Y')
build_window( 4.5, HY_MIN, 2.35, 1.7, 2.2, facing='-Y')
build_french_door(0.0, HY_MAX, Z_F1_BASE, width=2.4, height=2.6, facing='+Y')
build_window(-4.5, HY_MAX, 2.35, 1.7, 2.2, facing='+Y')
build_window( 4.5, HY_MAX, 2.35, 1.7, 2.2, facing='+Y')
for sy in [-2.2, 2.2]:
    build_window(HX_MIN, sy, 2.35, 1.6, 2.2, facing='-X')
    build_window(HX_MAX, sy, 2.35, 1.6, 2.2, facing='+X')

# === FLOOR 2 ===
ops_f2_front_main = [
    (-4.5, 5.70, 1.7, 2.1),
    ( 4.5, 5.70, 1.7, 2.1),
]
ops_f2_front_risalit = [
    (0.0, 5.52, 2.1, 2.6)
]
ops_f2_back = [
    (-4.5, 5.70, 1.7, 2.1),
    ( 0.0, 5.70, 1.7, 2.1),
    ( 4.5, 5.70, 1.7, 2.1),
]
ops_f2_sides = [
    (-2.2, 5.70, 1.6, 2.1),
    ( 2.2, 5.70, 1.6, 2.1)
]

build_facade_wall_with_openings(Z_F2_BASE, Z_F2_TOP, ops_f2_front_main, ops_f2_back, ops_f2_sides, ops_f2_sides)
build_risalit(Z_F2_BASE, Z_F2_TOP, ops_f2_front_risalit)

build_french_door(0.0, RY_MIN, Z_F2_BASE, width=2.1, height=2.6, facing='-Y')
build_window(-4.5, HY_MIN, 5.70, 1.7, 2.1, facing='-Y', has_pediment=True)
build_window( 4.5, HY_MIN, 5.70, 1.7, 2.1, facing='-Y', has_pediment=True)
for bx in [-4.5, 0.0, 4.5]:
    build_window(bx, HY_MAX, 5.70, 1.7, 2.1, facing='+Y')
for sy in [-2.2, 2.2]:
    build_window(HX_MIN, sy, 5.70, 1.6, 2.1, facing='-X')
    build_window(HX_MAX, sy, 5.70, 1.6, 2.1, facing='+X')

# === FLOOR 3 ===
ops_f3_front_main = [
    (-4.5, 8.95, 1.5, 1.9),
    ( 4.5, 8.95, 1.5, 1.9),
]
ops_f3_front_risalit = [
    (-1.15, 8.95, 1.25, 1.9),
    ( 1.15, 8.95, 1.25, 1.9),
]
ops_f3_back = [
    (-4.6, 8.95, 1.4, 1.9),
    (-1.6, 8.95, 1.4, 1.9),
    ( 1.6, 8.95, 1.4, 1.9),
    ( 4.6, 8.95, 1.4, 1.9),
]
ops_f3_sides = [
    (-2.2, 8.95, 1.5, 1.9),
    ( 2.2, 8.95, 1.5, 1.9)
]

build_facade_wall_with_openings(Z_F3_BASE, Z_F3_TOP, ops_f3_front_main, ops_f3_back, ops_f3_sides, ops_f3_sides)
build_risalit(Z_F3_BASE, Z_F3_TOP, ops_f3_front_risalit)

build_window(-4.5, HY_MIN, 8.95, 1.5, 1.9, facing='-Y')
build_window( 4.5, HY_MIN, 8.95, 1.5, 1.9, facing='-Y')
build_window(-1.15, RY_MIN, 8.95, 1.25, 1.9, facing='-Y')
build_window( 1.15, RY_MIN, 8.95, 1.25, 1.9, facing='-Y')
for bx in [-4.6, -1.6, 1.6, 4.6]:
    build_window(bx, HY_MAX, 8.95, 1.4, 1.9, facing='+Y')
for sy in [-2.2, 2.2]:
    build_window(HX_MIN, sy, 8.95, 1.5, 1.9, facing='-X')
    build_window(HX_MAX, sy, 8.95, 1.5, 1.9, facing='+X')

# -------------------------------------------------------------------------
# 12. ROOF STRUCTURE & CHIMNEYS & DORMERS (Roof01, Wood01, Bricks026, Concrete05)
# -------------------------------------------------------------------------
print("-> Building Hipped Roof, Dormers & Chimneys...")

ROOF_OVERHANG = 0.65
RX0 = HX_MIN - ROOF_OVERHANG
RX1 = HX_MAX + ROOF_OVERHANG
RY0 = HY_MIN - ROOF_OVERHANG
RY1 = HY_MAX + ROOF_OVERHANG
Z_EAVE = Z_CORNICE_TOP - 0.05
Z_RIDGE = Z_ROOF_RIDGE
RIDGE_X = 3.8

fascia_h = 0.16
add_box(bm_wood, RX0, RX1, RY0, RY0 + 0.05, Z_EAVE - fascia_h, Z_EAVE)
add_box(bm_wood, RX0, RX1, RY1 - 0.05, RY1, Z_EAVE - fascia_h, Z_EAVE)
add_box(bm_wood, RX0, RX0 + 0.05, RY0, RY1, Z_EAVE - fascia_h, Z_EAVE)
add_box(bm_wood, RX1 - 0.05, RX1, RY0, RY1, Z_EAVE - fascia_h, Z_EAVE)
add_box(bm_wood, RX0, RX1, RY0, RY1, Z_EAVE - fascia_h - 0.02, Z_EAVE - fascia_h)

v_eave_fl = bm_roof.verts.new((RX0, RY0, Z_EAVE))
v_eave_fr = bm_roof.verts.new((RX1, RY0, Z_EAVE))
v_eave_br = bm_roof.verts.new((RX1, RY1, Z_EAVE))
v_eave_bl = bm_roof.verts.new((RX0, RY1, Z_EAVE))

v_ridge_l = bm_roof.verts.new((-RIDGE_X, 0.0, Z_RIDGE))
v_ridge_r = bm_roof.verts.new(( RIDGE_X, 0.0, Z_RIDGE))

bm_roof.faces.new((v_eave_fl, v_eave_fr, v_ridge_r, v_ridge_l))
bm_roof.faces.new((v_eave_br, v_eave_bl, v_ridge_l, v_ridge_r))
bm_roof.faces.new((v_eave_bl, v_eave_fl, v_ridge_l))
bm_roof.faces.new((v_eave_fr, v_eave_br, v_ridge_r))

ridge_tile_w = 0.16
add_box(bm_roof, -RIDGE_X - 0.1, RIDGE_X + 0.1, -ridge_tile_w, ridge_tile_w, Z_RIDGE - 0.02, Z_RIDGE + 0.08)
add_pipe_segment(bm_roof, RX0, RY0, Z_EAVE, -RIDGE_X, 0.0, Z_RIDGE, radius=0.08, segments=8)
add_pipe_segment(bm_roof, RX1, RY0, Z_EAVE,  RIDGE_X, 0.0, Z_RIDGE, radius=0.08, segments=8)
add_pipe_segment(bm_roof, RX0, RY1, Z_EAVE, -RIDGE_X, 0.0, Z_RIDGE, radius=0.08, segments=8)
add_pipe_segment(bm_roof, RX1, RY1, Z_EAVE,  RIDGE_X, 0.0, Z_RIDGE, radius=0.08, segments=8)

def build_dormer(cx, z_base):
    # Compact, lowered dormer windows with solid cheeks penetrating into roof
    dw = 0.92
    half_dw = dw * 0.5
    dh = 0.98
    dormer_y_front = HY_MIN + 0.20  # -5.00m (sits solidly back on roof slope)
    dormer_y_back  = HY_MIN + 1.45  # -3.75m
    z_apex = z_base + dh + 0.26
    z_cheek_bottom = 10.50          # Extends well down into roof to prevent any floating

    # Solid Brick Cheeks (Bricks026) penetrating deep into the roof
    add_box(bm_brick, cx - half_dw, cx - half_dw + 0.12, dormer_y_front, dormer_y_back, z_cheek_bottom, z_base + dh)
    add_box(bm_brick, cx + half_dw - 0.12, cx + half_dw, dormer_y_front, dormer_y_back, z_cheek_bottom, z_base + dh)
    # Brick apron below window sill so nothing floats underneath
    add_box(bm_brick, cx - half_dw, cx + half_dw, dormer_y_front, dormer_y_front + 0.18, z_cheek_bottom, z_base)

    # Front Classical Pediment (Concrete05)
    v0 = bm_concrete.verts.new((cx - half_dw - 0.06, dormer_y_front - 0.04, z_base + dh))
    v1 = bm_concrete.verts.new((cx + half_dw + 0.06, dormer_y_front - 0.04, z_base + dh))
    v2 = bm_concrete.verts.new((cx, dormer_y_front - 0.04, z_apex))
    v0b = bm_concrete.verts.new((cx - half_dw - 0.06, dormer_y_front + 0.08, z_base + dh))
    v1b = bm_concrete.verts.new((cx + half_dw + 0.08, dormer_y_front + 0.08, z_base + dh))
    v2b = bm_concrete.verts.new((cx, dormer_y_front + 0.08, z_apex))
    bm_concrete.faces.new((v0, v1, v2))
    bm_concrete.faces.new((v0b, v2b, v1b))
    bm_concrete.faces.new((v0, v2, v2b, v0b))
    bm_concrete.faces.new((v1, v1b, v2b, v2))

    # Dormer Gabled Roof Slopes (Roof01) extending past cheeks and diving into main roof
    roof_back_y = dormer_y_back + 0.42
    eave_w = half_dw + 0.12
    eave_z = z_base + dh + 0.02
    vr_apex_f = bm_roof.verts.new((cx, dormer_y_front - 0.06, z_apex + 0.03))
    vr_apex_b = bm_roof.verts.new((cx, roof_back_y, z_apex + 0.03))
    vr_eave_l_f = bm_roof.verts.new((cx - eave_w, dormer_y_front - 0.06, eave_z))
    vr_eave_l_b = bm_roof.verts.new((cx - eave_w, roof_back_y, eave_z))
    vr_eave_r_f = bm_roof.verts.new((cx + eave_w, dormer_y_front - 0.06, eave_z))
    vr_eave_r_b = bm_roof.verts.new((cx + eave_w, roof_back_y, eave_z))

    bm_roof.faces.new((vr_eave_l_f, vr_apex_f, vr_apex_b, vr_eave_l_b))
    bm_roof.faces.new((vr_apex_f, vr_eave_r_f, vr_eave_r_b, vr_apex_b))

    # Dormer window frame & glass (stile and rail construction)
    fx0 = cx - half_dw + 0.12
    fx1 = cx + half_dw - 0.12
    fy0 = dormer_y_front - 0.01
    fy1 = dormer_y_front + 0.05
    fz0 = z_base
    fz1 = z_base + dh
    st_w = 0.06
    add_box(bm_wood, fx0, fx0 + st_w, fy0, fy1, fz0, fz1)
    add_box(bm_wood, fx1 - st_w, fx1, fy0, fy1, fz0, fz1)
    add_box(bm_wood, fx0, fx1, fy0, fy1, fz0, fz0 + st_w)
    add_box(bm_wood, fx0, fx1, fy0, fy1, fz1 - st_w, fz1)
    add_box(bm_wood, cx - 0.015, cx + 0.015, fy0, fy1, fz0, fz1)
    add_box(bm_glass, fx0 + st_w, cx - 0.015, dormer_y_front + 0.01, dormer_y_front + 0.02, fz0 + st_w, fz1 - st_w)
    add_box(bm_glass, cx + 0.015, fx1 - st_w, dormer_y_front + 0.01, dormer_y_front + 0.02, fz0 + st_w, fz1 - st_w)

build_dormer(-3.0, 10.95)
build_dormer( 3.0, 10.95)

def build_chimney(cx, cy, z_top=14.5):
    # Moved closer to center on the ridge to prevent hip ridge collisions
    cw = 0.95
    cd = 0.75
    half_w = cw * 0.5
    half_d = cd * 0.5
    z_start = 11.5

    add_box(bm_brick, cx - half_w, cx + half_w, cy - half_d, cy + half_d, z_start, z_top - 0.35)
    add_box(bm_concrete, cx - half_w - 0.06, cx + half_w + 0.06, cy - half_d - 0.06, cy + half_d + 0.06, z_top - 0.35, z_top - 0.20)
    add_box(bm_concrete, cx - half_w - 0.12, cx + half_w + 0.12, cy - half_d - 0.12, cy + half_d + 0.12, z_top - 0.20, z_top)

    for px in [cx - 0.22, cx + 0.22]:
        add_cylinder(bm_metal, px, cy, z_top, z_top + 0.42, radius=0.13, segments=12)
        add_cylinder(bm_metal, px, cy, z_top + 0.38, z_top + 0.45, radius=0.16, segments=12)

build_chimney(-1.8, 0.0)
build_chimney( 1.8, 0.0)

# -------------------------------------------------------------------------
# 13. GUTTERS & DOWNSPOUTS (Metal)
# -------------------------------------------------------------------------
print("-> Building Gutters & Downspouts (Metal)...")
gutter_w = 0.14
gutter_h = 0.10
gz0 = Z_EAVE - 0.06
gz1 = gz0 + gutter_h

add_box(bm_metal, RX0 - 0.04, RX1 + 0.04, RY0 - gutter_w, RY0, gz0, gz1)
add_box(bm_metal, RX0 - 0.04, RX1 + 0.04, RY1, RY1 + gutter_w, gz0, gz1)
add_box(bm_metal, RX0 - gutter_w, RX0, RY0 - 0.04, RY1 + 0.04, gz0, gz1)
add_box(bm_metal, RX1, RX1 + gutter_w, RY0 - 0.04, RY1 + 0.04, gz0, gz1)

downspout_corners = [
    (HX_MIN - 0.08, HY_MIN - 0.08),
    (HX_MAX + 0.08, HY_MIN - 0.08),
    (HX_MIN - 0.08, HY_MAX + 0.08),
    (HX_MAX + 0.08, HY_MAX + 0.08)
]
for dx, dy in downspout_corners:
    add_box(bm_metal, dx - 0.14, dx + 0.14, dy - 0.14, dy + 0.14, gz0 - 0.35, gz0)
    add_pipe_segment(bm_metal, dx, dy, gz0 - 0.35, dx, dy, Z_PLINTH_TOP - 0.30, radius=0.055, segments=12)
    for bz in [3.9, 7.2, 10.2]:
        add_box(bm_metal, dx - 0.08, dx + 0.08, dy - 0.08, dy + 0.08, bz - 0.03, bz + 0.03)
    add_pipe_segment(bm_metal, dx, dy, Z_PLINTH_TOP - 0.30, dx, dy - 0.15 if dy < 0 else dy + 0.15, Z_GROUND + 0.10, radius=0.055, segments=10)

# -------------------------------------------------------------------------
# 14. UV MAPPING & MESH FINALIZATION
# -------------------------------------------------------------------------
print("-> Finalizing BMesh UV Mapping & Topology...")

def uv_box_map_bmesh(bm, scale=0.5):
    """
    Direct procedural box mapping with uniform world scale.
    Ensures horizontal brick lines, zero distortion, perfect alignment across floors.
    CRITICAL: Updates face normals first so vectors are accurate.
    """
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        norm = face.normal
        ax, ay, az = abs(norm.x), abs(norm.y), abs(norm.z)

        if ay >= ax and ay >= az:
            # North / South (+Y / -Y) Wall
            sign = 1.0 if norm.y > 0 else -1.0
            for loop in face.loops:
                v = loop.vert.co
                u = v.x * sign * scale
                w = v.z * scale
                loop[uv_layer].uv = (u, w)
        elif ax > ay and ax >= az:
            # East / West (+X / -X) Wall
            sign = 1.0 if norm.x > 0 else -1.0
            for loop in face.loops:
                v = loop.vert.co
                u = -v.y * sign * scale
                w = v.z * scale
                loop[uv_layer].uv = (u, w)
        else:
            # Horizontal (+Z / -Z)
            for loop in face.loops:
                v = loop.vert.co
                u = v.x * scale
                w = v.y * scale
                loop[uv_layer].uv = (u, w)

def uv_map_roof_bmesh(bm, scale=0.5):
    bm.normal_update()
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        norm = face.normal
        ax, ay, az = abs(norm.x), abs(norm.y), abs(norm.z)
        if ay >= ax:
            # Front or back slope
            for loop in face.loops:
                v = loop.vert.co
                u = v.x * scale
                slope_dist = math.sqrt((v.y - 0.0)**2 + (v.z - Z_RIDGE)**2)
                loop[uv_layer].uv = (u, slope_dist * scale)
        else:
            # Left or right slope
            for loop in face.loops:
                v = loop.vert.co
                u = v.y * scale
                slope_dist = math.sqrt((abs(v.x) - RIDGE_X)**2 + (v.z - Z_RIDGE)**2)
                loop[uv_layer].uv = (u, slope_dist * scale)

# Apply robust UV maps
uv_box_map_bmesh(bm_brick, scale=0.5)
uv_box_map_bmesh(bm_concrete, scale=0.6)
uv_map_roof_bmesh(bm_roof, scale=0.5)
uv_box_map_bmesh(bm_wood, scale=0.8)

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
    house_collection.objects.link(obj)
    created_objects.append(obj)

    if not has_custom_uv:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.01)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)

bpy.ops.object.select_all(action='DESELECT')
for obj in created_objects:
    obj.select_set(True)
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)

bpy.context.view_layer.objects.active = created_objects[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# -------------------------------------------------------------------------
# 15. SAVE BLEND FILE & EXPORT GLTF / GLB
# -------------------------------------------------------------------------
print("-> Saving house.blend...")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)

print("-> Exporting scene.gltf (Separate + textures)...")
bpy.ops.export_scene.gltf(
    filepath=GLTF_OUT,
    export_format='GLTF_SEPARATE',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_yup=True,
    export_apply=True
)

print("-> Exporting house.glb (Self-contained binary)...")
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
# 16. RENDER FULL PREVIEW IMAGE
# -------------------------------------------------------------------------
print("-> Rendering full perspective preview...")
scene = bpy.context.scene

# Camera Setup (Framing full 3-story house nicely)
cam_data = bpy.data.cameras.new('MainCamera')
cam_data.lens = 38
cam_obj = bpy.data.objects.new('MainCamera', cam_data)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj

cam_obj.location = (-19.0, -25.0, 13.5)
# Look at center of house (0, -1, 6.8)
target = Vector((0.0, -1.0, 6.8))
direction = target - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

# Lighting Setup
light_data = bpy.data.lights.new('Sun', type='SUN')
light_data.energy = 4.5
light_data.color = (1.0, 0.98, 0.94)
light_obj = bpy.data.objects.new('Sun', light_data)
scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(52), math.radians(24), math.radians(-38))

# Fill light
fill_data = bpy.data.lights.new('Fill', type='SUN')
fill_data.energy = 1.2
fill_data.color = (0.85, 0.92, 1.0)
fill_obj = bpy.data.objects.new('Fill', fill_data)
scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(30), math.radians(-50), math.radians(120))

# Ground plane for shadows
bm_ground = bmesh.new()
add_box(bm_ground, -60, 60, -60, 60, -0.05, 0.0)
ground_mesh = bpy.data.meshes.new("Ground_Mesh")
bm_ground.to_mesh(ground_mesh)
bm_ground.free()
ground_obj = bpy.data.objects.new("Ground", ground_mesh)
ground_obj.data.materials.append(mat_concrete)
scene.collection.objects.link(ground_obj)

# Render settings
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderEngineEEVEENext') else 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = PREVIEW_OUT

# Use workbench or cycles fallback if eevee engine setting differs
try:
    bpy.ops.render.render(write_still=True)
except Exception as e:
    print(f"Warning on render: {e}, falling back to CYCLES")
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    bpy.ops.render.render(write_still=True)

# Render roof closeup
print("-> Rendering roof closeup...")
cam_obj.location = (-8.0, -13.0, 15.2)
target_roof = Vector((0.0, -2.0, 12.2))
cam_obj.rotation_euler = (target_roof - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\roof_preview.png"
bpy.ops.render.render(write_still=True)

# Render entrance closeup
print("-> Rendering entrance closeup...")
cam_obj.location = (0.0, -12.0, 2.5)
target_ent = Vector((0.0, -5.6, 2.3))
cam_obj.rotation_euler = (target_ent - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = r"C:\Users\Elshan\.gemini\antigravity\brain\c3effd0d-cb98-4748-b8ad-871c46cb52ca\entrance_preview.png"
bpy.ops.render.render(write_still=True)

print("=== 3D House Generation & Render Complete Successfully! ===")
