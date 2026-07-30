"""
PTG Appendix Builder - Entry point.
Run:     python main.py
Compile: pyinstaller AppendixBuilder.spec
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    from dependency_check import check_and_install_with_gui

    if not check_and_install_with_gui():
        sys.exit(1)

    import tkinter as tk

    from app import AppendixBuilderApp

    root = tk.Tk()
    root.title("PTG Appendix Builder")
    root.geometry("860x780")
    root.minsize(760, 620)
    AppendixBuilderApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
