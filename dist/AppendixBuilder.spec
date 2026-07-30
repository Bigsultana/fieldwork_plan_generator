# -*- mode: python ; coding: utf-8 -*-
# PyInstaller specification for Appendix Builder.

from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent

analysis = Analysis(
    [str(ROOT / "source" / "main.py")],
    pathex=[str(ROOT / "source")],
    binaries=[],
    datas=[],
    hiddenimports=[
        "tkinter",
        "tkinter.ttk",
        "tkinter.messagebox",
        "tkinter.filedialog",
        "pptx",
        "pptx.util",
        "pptx.dml.color",
        "pptx.enum.text",
        "PIL",
        "PIL.Image",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "matplotlib",
        "numpy",
        "pandas",
        "scipy",
        "PyQt5",
        "wx",
    ],
    noarchive=False,
)

pyz = PYZ(analysis.pure)

exe = EXE(
    pyz,
    analysis.scripts,
    analysis.binaries,
    analysis.datas,
    [],
    name="AppendixBuilder",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
)
