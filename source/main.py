"""Appendix Builder desktop application entry point."""

import tkinter as tk
from tkinter import messagebox


def main():
    try:
        from app import AppendixBuilderApp
    except ModuleNotFoundError as exc:
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror(
            "Missing dependency",
            f"A required Python package is missing: {exc.name}\n\nRun scripts\\setup.ps1, then try again.",
        )
        root.destroy()
        raise SystemExit(1) from exc

    root = tk.Tk()
    root.title("Appendix Builder")
    root.geometry("900x820")
    root.minsize(780, 640)
    AppendixBuilderApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
