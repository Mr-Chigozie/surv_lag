"""Builds the player vehicles in Blender and exports them as .glb files for the game.

Run (from the project folder):
  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python tools/blender/build_vehicles.py -- public/models
  or: npm run models

Coordinates are written in the game's (three.js) space so sizes match the collision boxes in
public/js/maps.js: x = right, y = up, z = backwards (the front of every vehicle faces -z).
The helpers convert to Blender's z-up space; the glTF exporter converts back.

Material names matter to the game:
  Body  -> repainted with the player's / traffic colour
  Shirt -> recoloured with the driver's outfit
  Head / Tail -> unlit glowing lights
Everything else keeps the colour set here.
"""

import math
import os
import sys

import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models"
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- materials
def srgb(hex_color):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((hex_color >> 16) & 255), lin((hex_color >> 8) & 255), lin(hex_color & 255), 1)


MATS = {}
PALETTE = {
    "Body": (0xffffff, 0.35, 0.38),
    "Shirt": (0x2f6fb0, 0.0, 0.85),
    "Glass": (0x1b2a33, 0.1, 0.12),
    "Tyre": (0x161616, 0.0, 0.9),
    "Rim": (0xa8a8a0, 0.8, 0.3),
    "Chrome": (0xd8d8d0, 0.9, 0.18),
    "Dark": (0x222222, 0.2, 0.7),
    "Trim": (0x111111, 0.1, 0.6),
    "Seat": (0x1a1a1a, 0.0, 0.8),
    "Skin": (0x4a2e1e, 0.0, 0.7),
    "Pants": (0x2a2a35, 0.0, 0.85),
    "Helmet": (0xe8e8e0, 0.3, 0.3),
    "HelmetDark": (0x16161a, 0.4, 0.25),
    "Stripe": (0x2e8a4d, 0.2, 0.5),
    "Canvas": (0x1c1c1c, 0.0, 0.9),
    "Rack": (0x3a3a3a, 0.5, 0.5),
    "Cargo": (0x8b6b3e, 0.0, 0.9),
    "Cargo2": (0x6fb3d9, 0.0, 0.9),
    "Conductor": (0xb8433a, 0.0, 0.85),
    "Plate": (0xf4f1e6, 0.0, 0.5),
    "Head": (0xfff2c8, 0.0, 0.3),
    "Tail": (0xff2a1a, 0.0, 0.3),
}


def mat(name):
    if name not in MATS:
        color, metal, rough = PALETTE[name]
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = srgb(color)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
        if name in ("Head", "Tail"):
            bsdf.inputs["Emission Color"].default_value = srgb(color)
            bsdf.inputs["Emission Strength"].default_value = 3.0
        MATS[name] = m
    return MATS[name]


# ---------------------------------------------------------------- primitives (game coordinates)
PARTS = []


def _place(obj, material, x, y, z, rx, ry, rz, bevel, smooth):
    obj.location = (x, -z, y)
    obj.rotation_euler = (rx, -rz, ry)
    obj.data.materials.append(mat(material))
    if bevel:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    if smooth or bevel:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    PARTS.append(obj)
    return obj


def box(w, h, d, material, x=0, y=0, z=0, rx=0, ry=0, rz=0, bevel=0.0, taper=None):
    """Box of width w (x), height h (y), depth d (z). taper=(sx, sz) shrinks the top face."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    for v in obj.data.vertices:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
        if taper and v.co.z > 0:
            v.co.x *= taper[0]
            v.co.y *= taper[1]
    return _place(obj, material, x, y, z, rx, ry, rz, bevel, False)


def cyl(r_top, r_bottom, h, material, x=0, y=0, z=0, rx=0, ry=0, rz=0, seg=16, bevel=0.0):
    """Cylinder along the game's y axis (rotate rz=pi/2 for a wheel)."""
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r_bottom, radius2=r_top, depth=h)
    obj = bpy.context.active_object
    return _place(obj, material, x, y, z, rx, ry, rz, bevel, True)


def ball(r, material, x=0, y=0, z=0, sx=1, sy=1, sz=1, seg=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=r)
    obj = bpy.context.active_object
    obj.scale = (sx, sz, sy)
    return _place(obj, material, x, y, z, 0, 0, 0, 0, True)


def wheel(x, y, z, r=0.36, w=0.28, spokes=0):
    half = math.pi / 2
    cyl(r, r, w, "Tyre", x, y, z, rz=half, seg=20, bevel=min(0.05, r * 0.15))
    cyl(r * 0.62, r * 0.62, w + 0.02, "Rim", x, y, z, rz=half, seg=16)
    cyl(r * 0.18, r * 0.18, w + 0.05, "Chrome", x, y, z, rz=half, seg=10)
    for i in range(spokes):
        a = i * math.pi / spokes
        box(0.03, r * 1.15, 0.03, "Rim", x, y, z, rx=a)


def rider(x, y, z, lean=-0.25, helmet=None):
    box(0.44, 0.58, 0.3, "Shirt", x, y + 0.32, z, rx=lean, bevel=0.06)
    box(0.34, 0.2, 0.5, "Pants", x, y - 0.02, z + 0.05, bevel=0.05)
    for side in (-1, 1):
        box(0.1, 0.42, 0.1, "Shirt", x + side * 0.25, y + 0.3, z - 0.28, rx=-1.0, bevel=0.03)
        ball(0.06, "Skin", x + side * 0.25, y + 0.15, z - 0.48)
        box(0.12, 0.45, 0.14, "Pants", x + side * 0.16, y - 0.2, z - 0.25, rx=0.6, bevel=0.03)
    hz = z + math.sin(lean) * 0.5
    if helmet:
        ball(0.19, helmet, x, y + 0.78, hz, sy=0.92, sz=1.1)
        box(0.27, 0.1, 0.06, "Glass", x, y + 0.79, hz - 0.18, bevel=0.02)
    else:
        ball(0.15, "Skin", x, y + 0.76, hz)


def mirrors(x, y, z):
    for side in (-1, 1):
        box(0.04, 0.03, 0.03, "Dark", side * (x - 0.04), y, z)
        box(0.12, 0.09, 0.05, "Body", side * x, y, z, bevel=0.015)


def plate(y, z):
    box(0.52, 0.14, 0.03, "Plate", 0, y, z)


# ---------------------------------------------------------------- vehicles
def car():
    L = 4.3
    box(1.8, 0.55, L, "Body", 0, 0.62, 0, bevel=0.1)
    box(1.62, 0.55, 2.15, "Glass", 0, 1.15, 0.25, bevel=0.05, taper=(0.86, 0.72))
    box(1.42, 0.07, 1.42, "Body", 0, 1.44, 0.3, bevel=0.03)
    box(1.76, 0.16, 1.15, "Body", 0, 0.94, -1.5, rx=-0.12, bevel=0.06)
    box(1.7, 0.14, 0.75, "Body", 0, 0.94, 1.75, rx=0.1, bevel=0.05)
    box(1.86, 0.24, 0.22, "Dark", 0, 0.42, -2.12, bevel=0.06)
    box(1.86, 0.24, 0.22, "Dark", 0, 0.42, 2.12, bevel=0.06)
    box(0.9, 0.16, 0.04, "Trim", 0, 0.72, -2.17)
    for i in range(4):
        box(0.86, 0.015, 0.045, "Chrome", 0, 0.66 + i * 0.04, -2.18)
    box(1.82, 0.04, 2.0, "Trim", 0, 0.8, 0.15)
    for side in (-1, 1):
        box(0.03, 0.04, 0.16, "Chrome", side * 0.91, 0.85, -0.2)
        box(0.03, 0.04, 0.16, "Chrome", side * 0.91, 0.85, 0.9)
    mirrors(0.98, 1.05, -0.75)
    plate(0.62, 2.18)
    for x in (-0.86, 0.86):
        for z in (-1.35, 1.35):
            wheel(x, 0.36, z)
    box(0.38, 0.13, 0.04, "Head", -0.62, 0.72, -2.16, bevel=0.015)
    box(0.38, 0.13, 0.04, "Head", 0.62, 0.72, -2.16, bevel=0.015)
    box(0.34, 0.14, 0.04, "Tail", -0.66, 0.74, 2.16, bevel=0.015)
    box(0.34, 0.14, 0.04, "Tail", 0.66, 0.74, 2.16, bevel=0.015)


def danfo():
    L = 5.0
    box(2.0, 1.5, L, "Body", 0, 1.12, 0.05, bevel=0.14)
    box(1.9, 0.6, 0.9, "Body", 0, 0.75, -2.35, bevel=0.12)
    box(2.03, 0.52, 3.7, "Glass", 0, 1.52, 0.45, bevel=0.03)
    for z in (-0.9, 0.0, 0.9, 1.8):
        box(2.05, 0.52, 0.08, "Body", 0, 1.52, z)
    box(1.84, 0.58, 0.06, "Glass", 0, 1.48, -2.42, rx=-0.15, bevel=0.03)
    box(2.05, 0.1, L + 0.04, "Trim", 0, 0.95, 0.05)
    box(2.05, 0.1, L + 0.04, "Trim", 0, 1.18, 0.05)
    box(0.04, 1.1, 0.95, "Trim", 1.01, 1.25, -0.8)  # open sliding door
    box(1.7, 0.08, 2.8, "Rack", 0, 1.92, 0.4)
    for z in (-0.9, 0.4, 1.7):
        box(1.7, 0.12, 0.06, "Rack", 0, 2.0, z)
    box(0.6, 0.3, 0.5, "Cargo", -0.3, 2.1, 0.8, bevel=0.03)
    box(2.06, 0.22, 0.22, "Dark", 0, 0.45, -2.75, bevel=0.06)
    box(2.06, 0.22, 0.16, "Dark", 0, 0.45, 2.57, bevel=0.05)
    mirrors(1.08, 1.35, -2.1)
    plate(0.62, 2.59)
    for x in (-0.95, 0.95):
        wheel(x, 0.38, -1.7, 0.38)
        wheel(x, 0.38, 1.6, 0.38)
    box(0.34, 0.2, 0.04, "Head", -0.7, 0.8, -2.81, bevel=0.02)
    box(0.34, 0.2, 0.04, "Head", 0.7, 0.8, -2.81, bevel=0.02)
    box(0.25, 0.3, 0.04, "Tail", -0.85, 0.9, 2.58, bevel=0.02)
    box(0.25, 0.3, 0.04, "Tail", 0.85, 0.9, 2.58, bevel=0.02)


def okada():
    box(0.34, 0.28, 0.75, "Body", 0, 0.88, -0.2, bevel=0.08)
    box(0.38, 0.22, 0.4, "Body", 0, 0.65, 0.55, bevel=0.06)
    box(0.36, 0.12, 0.4, "Body", 0, 0.62, -0.72, rx=0.3, bevel=0.04)  # front mudguard
    wheel(0, 0.33, -0.68, 0.32, 0.12, spokes=6)
    wheel(0, 0.33, 0.7, 0.32, 0.12, spokes=6)
    box(0.08, 0.7, 0.08, "Chrome", 0, 0.62, -0.62, rx=0.35)
    box(0.72, 0.05, 0.05, "Dark", 0, 1.12, -0.5)
    box(0.3, 0.12, 0.85, "Seat", 0, 1.03, 0.32, bevel=0.05)
    cyl(0.06, 0.06, 0.65, "Chrome", 0.2, 0.48, 0.38, rx=math.pi / 2)
    box(0.42, 0.06, 0.4, "Rack", 0, 0.95, 0.85)
    rider(0, 1.08, 0.18, -0.2, helmet="Helmet")
    box(0.18, 0.14, 0.05, "Head", 0, 1.0, -0.62, bevel=0.02)
    box(0.16, 0.08, 0.04, "Tail", 0, 0.82, 0.77)


def keke():
    box(1.3, 0.5, 1.45, "Body", 0, 0.62, 0.5, bevel=0.08)
    box(0.78, 0.5, 0.95, "Body", 0, 0.62, -0.72, bevel=0.08)
    box(0.82, 0.62, 0.1, "Body", 0, 0.98, -1.2, rx=-0.22, bevel=0.04)
    box(1.38, 0.08, 2.38, "Body", 0, 1.86, 0.1, bevel=0.035)
    box(0.76, 0.5, 0.04, "Glass", 0, 1.5, -1.12, rx=-0.2, bevel=0.02)
    box(1.32, 0.1, 1.47, "Stripe", 0, 0.84, 0.5)
    box(0.8, 0.1, 0.97, "Stripe", 0, 0.84, -0.72)
    box(1.3, 0.62, 0.04, "Canvas", 0, 1.5, 1.22)
    box(0.04, 0.5, 0.9, "Canvas", -0.65, 1.55, 0.7)  # side flaps rolled half down
    box(0.04, 0.5, 0.9, "Canvas", 0.65, 1.55, 0.7)
    box(1.1, 0.14, 0.5, "Seat", 0, 0.95, 0.75, bevel=0.04)
    box(1.1, 0.4, 0.1, "Seat", 0, 1.15, 1.0, bevel=0.03)
    box(0.6, 0.04, 0.04, "Chrome", 0, 1.18, -0.9)
    for x, z in ((-0.63, 1.2), (0.63, 1.2), (-0.4, -1.05), (0.4, -1.05)):
        box(0.06, 1.05, 0.06, "Dark", x, 1.35, z)
    mirrors(0.5, 1.3, -1.0)
    wheel(0, 0.27, -1.08, 0.27, 0.14)
    wheel(-0.6, 0.3, 0.85, 0.3, 0.16)
    wheel(0.6, 0.3, 0.85, 0.3, 0.16)
    rider(0, 0.98, -0.5, -0.12)
    box(0.22, 0.15, 0.04, "Head", 0, 1.0, -1.27, bevel=0.02)
    box(0.14, 0.14, 0.04, "Tail", -0.55, 0.72, 1.23)
    box(0.14, 0.14, 0.04, "Tail", 0.55, 0.72, 1.23)


def molue():
    L = 9.5
    box(2.45, 2.3, L, "Body", 0, 1.7, 0, bevel=0.16)
    box(2.3, 0.35, L - 0.6, "Body", 0, 2.98, 0, bevel=0.14)
    box(2.47, 0.78, L - 1.6, "Glass", 0, 2.25, 0.4)
    z = -3.6
    while z < 4.4:  # window pillars
        box(2.49, 0.8, 0.09, "Body", 0, 2.25, z)
        z += 0.85
    box(2.25, 0.95, 0.05, "Glass", 0, 2.15, -L / 2 - 0.01, bevel=0.03)
    box(2.48, 0.13, L + 0.02, "Trim", 0, 1.55, 0)
    box(2.48, 0.13, L + 0.02, "Trim", 0, 1.25, 0)
    box(2.48, 1.5, 0.95, "Trim", 0, 1.55, -3.3)  # open doorways
    box(2.48, 1.5, 0.95, "Trim", 0, 1.55, 2.6)
    box(1.9, 0.1, 5.5, "Rack", 0, 3.22, 0.3)
    for zz in (-2.3, -0.8, 0.8, 2.3):
        box(1.9, 0.18, 0.06, "Rack", 0, 3.3, zz)
    box(0.5, 0.35, 0.6, "Cargo", -0.4, 3.45, -0.8, bevel=0.03)
    box(0.6, 0.3, 0.5, "Cargo2", 0.45, 3.43, 1.4, bevel=0.03)
    box(0.7, 0.28, 0.45, "Cargo", 0.2, 3.42, -2.0, bevel=0.03)
    box(2.5, 0.3, 0.25, "Dark", 0, 0.6, -L / 2 - 0.08, bevel=0.06)
    box(2.5, 0.3, 0.2, "Dark", 0, 0.6, L / 2 + 0.05, bevel=0.06)
    box(1.2, 0.18, 0.04, "Trim", 0, 3.0, -L / 2 - 0.02)
    mirrors(1.35, 2.2, -4.5)
    plate(0.85, L / 2 + 0.06)
    # conductor hanging out of the front door
    box(0.3, 0.6, 0.28, "Conductor", 1.32, 1.85, -3.3, rz=-0.25, bevel=0.05)
    ball(0.14, "Skin", 1.42, 2.3, -3.3)
    box(0.1, 0.5, 0.1, "Skin", 1.25, 2.3, -3.05, rz=0.3)
    box(0.12, 0.5, 0.14, "Pants", 1.3, 1.35, -3.3)
    for x in (-1.1, 1.1):
        for zz in (-3.0, 2.9, 3.9):
            wheel(x, 0.55, zz, 0.55, 0.35)
    for x in (-0.85, 0.85):
        box(0.38, 0.22, 0.04, "Head", x, 0.95, -L / 2 - 0.02, bevel=0.02)
    for x in (-1.0, 1.0):
        box(0.28, 0.35, 0.04, "Tail", x, 1.0, L / 2 + 0.02, bevel=0.02)


def superbike():
    box(0.42, 0.42, 0.85, "Body", 0, 0.82, -0.45, bevel=0.12, taper=(0.75, 0.8))
    box(0.36, 0.24, 0.5, "Body", 0, 1.02, -0.02, bevel=0.09)
    box(0.28, 0.16, 0.55, "Body", 0, 1.08, 0.62, rx=0.25, bevel=0.06, taper=(0.6, 0.9))
    box(0.32, 0.24, 0.6, "Dark", 0, 0.55, 0.05, bevel=0.05)
    box(0.3, 0.2, 0.04, "Glass", 0, 1.12, -0.86, rx=-0.7, bevel=0.02)
    wheel(0, 0.33, -0.72, 0.33, 0.17)
    wheel(0, 0.34, 0.72, 0.34, 0.2)
    box(0.07, 0.6, 0.07, "Chrome", -0.1, 0.62, -0.68, rx=0.4)
    box(0.07, 0.6, 0.07, "Chrome", 0.1, 0.62, -0.68, rx=0.4)
    cyl(0.07, 0.08, 0.5, "Chrome", 0.2, 0.62, 0.55, rx=math.pi / 2 - 0.2)
    box(0.28, 0.08, 0.45, "Seat", 0, 1.1, 0.3, bevel=0.03)
    rider(0, 1.08, 0.12, -0.75, helmet="HelmetDark")
    box(0.24, 0.1, 0.05, "Head", 0, 0.92, -0.89, bevel=0.02)
    box(0.18, 0.06, 0.04, "Tail", 0, 1.15, 0.9)


def suv():
    L = 4.9
    box(1.98, 0.85, L, "Body", 0, 0.88, 0, bevel=0.12)
    box(1.88, 0.62, 3.0, "Glass", 0, 1.6, 0.4, bevel=0.05, taper=(0.94, 0.95))
    box(1.82, 0.08, 2.88, "Body", 0, 1.94, 0.42, bevel=0.04)
    box(1.92, 0.2, 1.2, "Body", 0, 1.36, -1.8, rx=-0.06, bevel=0.07)
    for z in (-0.35, 0.75):
        box(1.9, 0.62, 0.09, "Body", 0, 1.6, z)
    box(2.02, 0.3, 0.25, "Dark", 0, 0.46, -2.45, bevel=0.06)
    box(2.02, 0.3, 0.25, "Dark", 0, 0.46, 2.45, bevel=0.06)
    box(1.2, 0.32, 0.04, "Chrome", 0, 0.98, -2.46, bevel=0.02)
    for i in range(5):
        box(1.1, 0.02, 0.05, "Trim", 0, 0.86 + i * 0.06, -2.48)
    box(0.06, 0.06, 2.7, "Chrome", -0.82, 2.01, 0.4)
    box(0.06, 0.06, 2.7, "Chrome", 0.82, 2.01, 0.4)
    box(0.14, 0.06, 2.5, "Dark", -1.04, 0.46, 0)
    box(0.14, 0.06, 2.5, "Dark", 1.04, 0.46, 0)
    for side in (-1, 1):
        box(0.03, 0.04, 0.18, "Chrome", side * 1.0, 1.15, -0.4)
        box(0.03, 0.04, 0.18, "Chrome", side * 1.0, 1.15, 0.8)
    cyl(0.38, 0.38, 0.22, "Tyre", 0, 1.0, 2.55, rx=math.pi / 2, seg=20)
    cyl(0.2, 0.2, 0.24, "Chrome", 0, 1.0, 2.55, rx=math.pi / 2)
    mirrors(1.08, 1.4, -1.05)
    plate(0.62, 2.49)
    for x in (-0.92, 0.92):
        for z in (-1.55, 1.55):
            wheel(x, 0.44, z, 0.44, 0.32)
    for x in (-0.7, 0.7):
        box(0.42, 0.12, 0.04, "Head", x, 1.08, -2.46, bevel=0.015)
    for x in (-0.9, 0.9):
        box(0.12, 0.4, 0.04, "Tail", x, 1.1, 2.46, bevel=0.015)


VEHICLES = {"car": car, "danfo": danfo, "okada": okada, "keke": keke, "molue": molue, "superbike": superbike, "suv": suv}


def build(name, fn):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    PARTS.clear()
    fn()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in PARTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    # apply bevels per part, then merge into one object (one draw call per material in the game)
    for obj in PARTS:
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.join()
    vehicle = bpy.context.active_object
    vehicle.name = name
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in vehicle.data.polygons)
    print(f"[models] {name}: {tris} triangles, {len(vehicle.data.materials)} materials -> {path}")


only = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []
for name, fn in VEHICLES.items():
    if not only or name in only:
        build(name, fn)
