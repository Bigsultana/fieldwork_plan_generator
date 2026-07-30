# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec — PTG Appendix Builder
# Run: pyinstaller AppendixBuilder.spec

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('assets', 'assets'),   # include logo/assets folder
    ],
    hiddenimports=[
        'tkinter', 'tkinter.ttk', 'tkinter.messagebox', 'tkinter.filedialog',
        'pptx', 'pptx.util', 'pptx.dml.color', 'pptx.enum.text',
        'pptx.oxml.ns', 'lxml', 'lxml.etree',
        'PIL', 'PIL.Image',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'numpy', 'pandas', 'scipy', 'PyQt5', 'wx'],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PTG_AppendixBuilder',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    # icon='assets/icon.ico',  # uncomment and add icon.ico if desired
)
