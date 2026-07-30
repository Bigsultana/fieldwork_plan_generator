"""
dependency_check.py — Auto-installs missing dependencies on first run.
Drop this file into any project folder and call check_and_install() at startup.
"""

import sys
import subprocess
import importlib

# Map: (import_name, pip_package_name, minimum_version_display)
DEPENDENCIES = [
    ("pptx", "python-pptx", "0.6.21"),
    ("PIL", "Pillow", "10.0.0"),
    ("lxml", "lxml", "4.9.0"),
]


def _is_installed(import_name: str) -> bool:
    try:
        importlib.import_module(import_name)
        return True
    except ImportError:
        return False


def _install(pip_name: str) -> bool:
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", pip_name, "--quiet"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def check_and_install(silent: bool = False) -> list:
    """
    Check for required packages and install any that are missing.

    Args:
        silent: If True, suppress all print output (use when GUI is already up).

    Returns:
        List of packages that failed to install (empty = all good).
    """
    missing = [(imp, pip) for imp, pip, _ in DEPENDENCIES if not _is_installed(imp)]
    failed = []

    if not missing:
        return []

    if not silent:
        print("─" * 52)
        print("PTG Tools — First-run dependency installer")
        print("─" * 52)
        print(f"Missing packages: {', '.join(pip for _, pip in missing)}")
        print("Installing now (requires internet connection)...")
        print()

    for import_name, pip_name in missing:
        if not silent:
            print(f"  Installing {pip_name}...", end=" ", flush=True)
        ok = _install(pip_name)
        if ok:
            if not silent:
                print("done")
        else:
            if not silent:
                print("FAILED")
            failed.append(pip_name)

    if not silent:
        print()
        if failed:
            print(f"✗ Could not install: {', '.join(failed)}")
            print("  Try running manually:  pip install " + " ".join(failed))
        else:
            print("✓ All dependencies installed. Starting application...")
        print("─" * 52)
        print()

    return failed


def check_and_install_with_gui() -> bool:
    """
    Show a tkinter progress window while installing dependencies.
    Used when launching a GUI app for the first time.
    Returns True if all dependencies are ready, False if any failed.
    """
    import tkinter as tk
    from tkinter import ttk, messagebox

    missing = [
        (imp, pip, ver) for imp, pip, ver in DEPENDENCIES if not _is_installed(imp)
    ]
    if not missing:
        return True

    # Build a small installer window
    root = tk.Tk()
    root.title("PTG Tools — Installing Dependencies")
    root.geometry("440x240")
    root.resizable(False, False)
    root.configure(bg="#1e2228")

    tk.Label(
        root,
        text="PTG Tools — First Run Setup",
        bg="#1e2228",
        fg="#e8eaf0",
        font=("Segoe UI", 12, "bold"),
    ).pack(pady=(20, 4))
    tk.Label(
        root,
        text="Installing required Python packages...",
        bg="#1e2228",
        fg="#9aa0ad",
        font=("Segoe UI", 9),
    ).pack(pady=(0, 12))

    progress = ttk.Progressbar(root, length=360, mode="determinate")
    progress.pack(pady=4)

    status = tk.Label(root, text="", bg="#1e2228", fg="#5eaaed", font=("Consolas", 9))
    status.pack(pady=4)

    log = tk.Text(
        root,
        height=4,
        bg="#1a1e24",
        fg="#9aa0ad",
        font=("Consolas", 8),
        relief="flat",
        state="disabled",
    )
    log.pack(fill="x", padx=20, pady=(4, 0))

    def append_log(msg):
        log.configure(state="normal")
        log.insert("end", msg + "\n")
        log.see("end")
        log.configure(state="disabled")
        root.update_idletasks()

    failed = []

    def run_install():
        total = len(missing)
        for i, (import_name, pip_name, ver) in enumerate(missing):
            status.configure(text=f"Installing {pip_name} >= {ver}")
            append_log(f"pip install {pip_name} ...")
            root.update_idletasks()

            ok = _install(pip_name)
            if ok:
                append_log(f"  ✓ {pip_name} installed")
            else:
                append_log(f"  ✗ {pip_name} FAILED")
                failed.append(pip_name)

            progress["value"] = ((i + 1) / total) * 100
            root.update_idletasks()

        root.after(400, finish)

    def finish():
        root.destroy()
        if failed:
            messagebox.showerror(
                "Installation failed",
                f"Could not install: {', '.join(failed)}\n\n"
                f"Please run manually in a terminal:\n"
                f"pip install {' '.join(failed)}\n\n"
                f"Then restart the application.",
            )

    root.after(200, run_install)
    root.mainloop()

    return len(failed) == 0
