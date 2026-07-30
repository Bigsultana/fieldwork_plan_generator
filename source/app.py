"""
PTG Appendix Builder - Desktop Application
Assembles a formal PTG-formatted appendix PPTX from exported images.
"""

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from utils.builder import build_appendix
from utils.config_loader import (
    build_sheets_from_image_paths,
    build_sheets_from_images,
    load_project_config,
    load_sheet_config,
    resolve_optional_path,
    save_default_config,
    save_default_sheet_csv,
    validate_sheet_config,
)

BG_MAIN = "#1e2228"
BG_CARD = "#262b33"
BG_INPUT = "#1a1e24"
BG_ACCENT = "#2d6a9f"
FG_PRI = "#e8eaf0"
FG_SEC = "#9aa0ad"
FG_BRD = "#3a3f4a"

FONT_BODY = ("Segoe UI", 10)
FONT_LBL = ("Segoe UI", 9)
FONT_TINY = ("Segoe UI", 8)
FONT_MONO = ("Consolas", 9)


class AppendixBuilderApp:
    def __init__(self, root):
        self.root = root
        self.root.configure(bg=BG_MAIN)
        self.root.title("PTG Appendix Builder")
        self.root.geometry("860x820")
        self.root.minsize(780, 640)

        self._event_queue = queue.Queue()
        self._build_running = False
        self._loaded_config_path = ""
        self.manual_sheets = []

        self._configure_styles()
        self._build_ui()

        self.v_exports_dir.trace_add("write", lambda *a: self._refresh_sheet_table())
        self.v_prefix.trace_add("write", lambda *a: self._refresh_sheet_table())
        self.v_sheets_csv.trace_add("write", lambda *a: self._refresh_sheet_table())
        self.root.after(100, self._process_ui_events)

    def _configure_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background=BG_MAIN)
        style.configure("TLabel", background=BG_CARD, foreground=FG_PRI, font=FONT_BODY)
        style.configure(
            "TEntry", fieldbackground=BG_INPUT, foreground=FG_PRI, insertcolor=FG_PRI
        )
        style.configure("TCombobox", fieldbackground=BG_INPUT, foreground=FG_PRI)
        style.configure("TProgressbar", troughcolor=BG_INPUT, background=BG_ACCENT)
        style.map("TCombobox", fieldbackground=[("readonly", BG_INPUT)])

    def _build_ui(self):
        bar = tk.Frame(self.root, bg=BG_ACCENT, height=44)
        bar.pack(fill="x")
        bar.pack_propagate(False)
        tk.Label(
            bar,
            text="  PTG Appendix Builder",
            bg=BG_ACCENT,
            fg="white",
            font=("Segoe UI", 12, "bold"),
        ).pack(side="left", pady=10)
        tk.Label(bar, text="v2.3  ", bg=BG_ACCENT, fg="#c0d8f0", font=FONT_TINY).pack(
            side="right", pady=10
        )

        outer = tk.Frame(self.root, bg=BG_MAIN)
        outer.pack(fill="both", expand=True)
        canvas = tk.Canvas(outer, bg=BG_MAIN, highlightthickness=0)
        sb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        self.sf = tk.Frame(canvas, bg=BG_MAIN)
        win = canvas.create_window((0, 0), window=self.sf, anchor="nw")
        self.sf.bind(
            "<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(win, width=e.width))
        canvas.bind_all(
            "<MouseWheel>",
            lambda e: canvas.yview_scroll(-1 * (e.delta // 120), "units"),
        )

        pad = tk.Frame(self.sf, bg=BG_MAIN)
        pad.pack(fill="both", expand=True, padx=16, pady=12)

        self._build_project_section(pad)
        self._build_company_section(pad)
        self._build_paths_section(pad)
        self._build_sheets_section(pad)
        self._build_output_section(pad)
        self._build_run_section(pad)

    def _card(self, parent, title=None):
        outer = tk.Frame(parent, bg=FG_BRD, pady=1, padx=1)
        outer.pack(fill="x", pady=5)
        inner = tk.Frame(outer, bg=BG_CARD, padx=14, pady=12)
        inner.pack(fill="both", expand=True)
        if title:
            tk.Label(
                inner,
                text=title.upper(),
                bg=BG_CARD,
                fg=FG_SEC,
                font=("Segoe UI", 8, "bold"),
            ).pack(anchor="w", pady=(0, 8))
        return inner

    def _field_row(self, parent, label, var, width=30):
        row = tk.Frame(parent, bg=BG_CARD)
        row.pack(fill="x", pady=3)
        tk.Label(
            row, text=label, bg=BG_CARD, fg=FG_SEC, font=FONT_LBL, width=20, anchor="w"
        ).pack(side="left")
        entry = ttk.Entry(row, textvariable=var, width=width)
        entry.pack(side="left", fill="x", expand=True)
        return entry

    def _path_row(self, parent, label, var, is_dir=False, save_file=False):
        row = tk.Frame(parent, bg=BG_CARD)
        row.pack(fill="x", pady=3)
        tk.Label(
            row, text=label, bg=BG_CARD, fg=FG_SEC, font=FONT_LBL, width=20, anchor="w"
        ).pack(side="left")
        ttk.Entry(row, textvariable=var, width=38).pack(
            side="left", fill="x", expand=True, padx=(0, 6)
        )

        def choose_dir():
            var.set(filedialog.askdirectory(title=label))

        def choose_save_file():
            var.set(
                filedialog.asksaveasfilename(
                    defaultextension=".pptx",
                    filetypes=[("PowerPoint", "*.pptx")],
                    title=label,
                )
            )

        def choose_file():
            var.set(filedialog.askopenfilename(title=label))

        if is_dir:
            command = choose_dir
        elif save_file:
            command = choose_save_file
        else:
            command = choose_file
        tk.Button(
            row,
            text="Browse",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=command,
        ).pack(side="left")

    def _build_project_section(self, parent):
        card = self._card(parent, "Project Details")
        self.v_proj_title = tk.StringVar(value="")
        self.v_proj_addr = tk.StringVar(value="")
        self.v_proj_number = tk.StringVar(value="")
        self.v_client = tk.StringVar(value="")
        self.v_drawn = tk.StringVar(value="")
        self.v_designed = tk.StringVar(value="")
        self.v_approved = tk.StringVar(value="")
        self.v_date = tk.StringVar(value="")
        self.v_status = tk.StringVar(value="FOR INFORMATION")
        self.v_prefix = tk.StringVar(value="A")

        self._field_row(card, "Project Title", self.v_proj_title)
        self._field_row(card, "Project Address", self.v_proj_addr)
        self._field_row(card, "Project Number", self.v_proj_number)
        self._field_row(card, "Client Name", self.v_client)

        row2 = tk.Frame(card, bg=BG_CARD)
        row2.pack(fill="x", pady=6)
        for label, var, width in [
            ("Drawn By", self.v_drawn, 8),
            ("Designed By", self.v_designed, 8),
            ("Approved By", self.v_approved, 8),
            ("Date", self.v_date, 10),
            ("Sheet Prefix", self.v_prefix, 5),
        ]:
            col = tk.Frame(row2, bg=BG_CARD)
            col.pack(side="left", padx=(0, 14))
            tk.Label(col, text=label, bg=BG_CARD, fg=FG_SEC, font=FONT_TINY).pack(
                anchor="w"
            )
            ttk.Entry(col, textvariable=var, width=width).pack()

        ds_row = tk.Frame(card, bg=BG_CARD)
        ds_row.pack(fill="x", pady=3)
        tk.Label(
            ds_row,
            text="Drawing Status",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LBL,
            width=20,
            anchor="w",
        ).pack(side="left")
        ttk.Combobox(
            ds_row,
            textvariable=self.v_status,
            values=[
                "FOR INFORMATION",
                "FOR APPROVAL",
                "FOR CONSTRUCTION",
                "DRAFT",
                "AS BUILT",
            ],
            state="readonly",
            width=28,
        ).pack(side="left")

        btn_row = tk.Frame(card, bg=BG_CARD)
        btn_row.pack(fill="x", pady=(10, 0))
        for label, cmd in [
            ("Load project_config.json", self._load_config),
            ("Save project_config.json", self._save_config),
            ("Create template config", self._create_template_config),
        ]:
            tk.Button(
                btn_row,
                text=label,
                font=FONT_TINY,
                bg=BG_INPUT,
                fg=FG_SEC,
                relief="flat",
                padx=8,
                pady=5,
                cursor="hand2",
                command=cmd,
            ).pack(side="left", padx=(0, 8))

    def _build_company_section(self, parent):
        card = self._card(parent, "Company / Titleblock")
        self.v_company_name = tk.StringVar(value="PTG CONSULTING")
        self.v_company_address = tk.StringVar(
            value="Level 3, 159 Coronation Drive (CNR Cribb St), Milton QLD 4064"
        )
        self.v_company_phone = tk.StringVar(value="(07) 3444 6666")
        self.v_company_email = tk.StringVar(value="admin@ptgconsulting.com.au")
        self.v_company_website = tk.StringVar(value="www.ptgconsulting.com.au")

        self._field_row(card, "Company Name", self.v_company_name)
        self._field_row(card, "Company Address", self.v_company_address)

        row = tk.Frame(card, bg=BG_CARD)
        row.pack(fill="x", pady=3)
        for label, var, width in [
            ("Phone", self.v_company_phone, 18),
            ("Email", self.v_company_email, 26),
            ("Website", self.v_company_website, 24),
        ]:
            col = tk.Frame(row, bg=BG_CARD)
            col.pack(side="left", padx=(0, 14))
            tk.Label(col, text=label, bg=BG_CARD, fg=FG_SEC, font=FONT_TINY).pack(
                anchor="w"
            )
            ttk.Entry(col, textvariable=var, width=width).pack()

    def _build_paths_section(self, parent):
        card = self._card(parent, "File Paths")
        self.v_exports_dir = tk.StringVar()
        self.v_logo_path = tk.StringVar()
        self.v_template_path = tk.StringVar(value="assets/PTG_Appendix_Template.pptx")
        self.v_output_path = tk.StringVar()
        self.v_sheet_mode = tk.StringVar(value="folder")

        self._path_row(card, "Exports folder", self.v_exports_dir, is_dir=True)
        self._path_row(card, "Logo image (opt.)", self.v_logo_path)
        self._path_row(card, "Template PPTX", self.v_template_path)

        mode_row = tk.Frame(card, bg=BG_CARD)
        mode_row.pack(fill="x", pady=(4, 6))
        tk.Label(
            mode_row,
            text="Sheet source",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LBL,
            width=20,
            anchor="w",
        ).pack(side="left")
        for label, value in [
            ("Selected images", "manual"),
            ("Folder order", "folder"),
            ("CSV", "csv"),
        ]:
            tk.Radiobutton(
                mode_row,
                text=label,
                value=value,
                variable=self.v_sheet_mode,
                bg=BG_CARD,
                fg=FG_PRI,
                selectcolor=BG_INPUT,
                activebackground=BG_CARD,
                activeforeground=FG_PRI,
                font=FONT_LBL,
                command=self._refresh_sheet_table,
            ).pack(side="left", padx=(0, 12))

        self._path_row(card, "Output .pptx", self.v_output_path, save_file=True)
        tk.Label(
            card,
            text=(
                "Tip: use Selected images for an editable in-app sheet register, "
                "Folder order for a quick auto-build, or CSV for a saved register."
            ),
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_TINY,
        ).pack(anchor="w", pady=(6, 0))

    def _build_sheets_section(self, parent):
        card = self._card(parent, "Sheet List")
        tk.Label(
            card,
            text=(
                "Manual mode lets you select images and then edit sheet number, "
                "title, filename pattern, and scale inside the app."
            ),
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_TINY,
        ).pack(anchor="w", pady=(0, 8))

        self.v_sheets_csv = tk.StringVar()
        csv_row = tk.Frame(card, bg=BG_CARD)
        csv_row.pack(fill="x", pady=(0, 8))
        tk.Label(
            csv_row,
            text="sheets.csv (opt.)",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LBL,
            width=20,
            anchor="w",
        ).pack(side="left")
        ttk.Entry(csv_row, textvariable=self.v_sheets_csv, width=38).pack(
            side="left", fill="x", expand=True, padx=(0, 6)
        )
        tk.Button(
            csv_row,
            text="Browse",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=lambda: self.v_sheets_csv.set(
                filedialog.askopenfilename(
                    filetypes=[("CSV", "*.csv")], title="Select sheets.csv"
                )
            ),
        ).pack(side="left")
        tk.Button(
            csv_row,
            text="Create template CSV",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self._create_template_csv,
        ).pack(side="left", padx=(8, 0))

        manual_btn_row = tk.Frame(card, bg=BG_CARD)
        manual_btn_row.pack(fill="x", pady=(0, 8))
        self.import_images_btn = tk.Button(
            manual_btn_row,
            text="Select Images...",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self._select_manual_images,
        )
        self.import_images_btn.pack(side="left")
        self.edit_sheet_btn = tk.Button(
            manual_btn_row,
            text="Edit Selected",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self._edit_selected_sheet,
        )
        self.edit_sheet_btn.pack(side="left", padx=(8, 0))
        self.move_up_btn = tk.Button(
            manual_btn_row,
            text="Move Up",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=lambda: self._move_selected_sheet(-1),
        )
        self.move_up_btn.pack(side="left", padx=(8, 0))
        self.move_down_btn = tk.Button(
            manual_btn_row,
            text="Move Down",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=lambda: self._move_selected_sheet(1),
        )
        self.move_down_btn.pack(side="left", padx=(8, 0))
        self.remove_sheet_btn = tk.Button(
            manual_btn_row,
            text="Remove",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=8,
            pady=4,
            cursor="hand2",
            command=self._remove_selected_sheet,
        )
        self.remove_sheet_btn.pack(side="left", padx=(8, 0))

        self.sheet_preview_label = tk.Label(
            card,
            text="SHEET PREVIEW",
            bg=BG_CARD,
            fg=FG_SEC,
            font=("Segoe UI", 8, "bold"),
        )
        self.sheet_preview_label.pack(anchor="w", pady=(0, 4))

        tbl_frame = tk.Frame(card, bg=BG_CARD)
        tbl_frame.pack(fill="x")
        cols = ("#", "Sheet Title", "Filename Pattern", "Scale")
        self.sheet_tree = ttk.Treeview(
            tbl_frame, columns=cols, show="headings", height=8
        )
        for column, width in zip(cols, [50, 320, 220, 80]):
            self.sheet_tree.heading(column, text=column)
            self.sheet_tree.column(column, width=width, anchor="w")
        self.sheet_tree.pack(side="left", fill="x", expand=True)
        sb2 = ttk.Scrollbar(tbl_frame, orient="vertical", command=self.sheet_tree.yview)
        self.sheet_tree.configure(yscrollcommand=sb2.set)
        sb2.pack(side="right", fill="y")
        self.sheet_tree.bind("<Double-1>", lambda _e: self._edit_selected_sheet())

        self._refresh_sheet_table()

    def _refresh_sheet_table(self, *_):
        if not hasattr(self, "sheet_tree"):
            return
        for row in self.sheet_tree.get_children():
            self.sheet_tree.delete(row)

        sheets = self._get_current_sheets()
        preview_titles = {
            "manual": "SHEET PREVIEW (editable selected images)",
            "folder": "SHEET PREVIEW (folder order)",
            "csv": "SHEET PREVIEW (loaded CSV or defaults)",
        }
        self.sheet_preview_label.configure(
            text=preview_titles.get(self.v_sheet_mode.get(), "SHEET PREVIEW")
        )

        for sheet in sheets:
            title = sheet.get("drawing_title_1", "")
            if sheet.get("drawing_title_2"):
                title += f" - {sheet['drawing_title_2']}"
            self.sheet_tree.insert(
                "",
                "end",
                values=(
                    sheet.get("sheet_number", ""),
                    title,
                    sheet.get("filename_pattern", ""),
                    sheet.get("scale", "NTS"),
                ),
            )
        self._update_manual_buttons()

    def _get_current_sheets(self):
        mode = self.v_sheet_mode.get()
        if mode == "manual":
            return [dict(sheet) for sheet in self.manual_sheets]
        if mode == "folder":
            return build_sheets_from_images(
                self.v_exports_dir.get().strip(), self.v_prefix.get().strip() or "A"
            )
        return load_sheet_config(self.v_sheets_csv.get())

    def _update_manual_buttons(self):
        state = "normal" if self.v_sheet_mode.get() == "manual" else "disabled"
        for widget in [
            self.import_images_btn,
            self.edit_sheet_btn,
            self.move_up_btn,
            self.move_down_btn,
            self.remove_sheet_btn,
        ]:
            widget.configure(state=state)

    def _select_manual_images(self):
        image_paths = filedialog.askopenfilenames(
            title="Select images for appendix",
            filetypes=[
                ("Image files", "*.jpg *.jpeg *.png *.tif *.tiff *.bmp"),
                ("All files", "*.*"),
            ],
        )
        if not image_paths:
            return
        self.manual_sheets = build_sheets_from_image_paths(list(image_paths))
        self.v_sheet_mode.set("manual")
        self._refresh_sheet_table()
        self._log(
            f"Loaded {len(self.manual_sheets)} selected image(s) into the editable sheet list."
        )

    def _get_selected_sheet_index(self):
        selection = self.sheet_tree.selection()
        if not selection:
            return None
        return self.sheet_tree.index(selection[0])

    def _edit_selected_sheet(self):
        if self.v_sheet_mode.get() != "manual":
            messagebox.showinfo(
                "Manual editing",
                "Switch to Selected images mode to edit the sheet list inside the app.",
            )
            return
        index = self._get_selected_sheet_index()
        if index is None or index >= len(self.manual_sheets):
            messagebox.showinfo("Select a sheet", "Select a sheet row to edit.")
            return

        sheet = self.manual_sheets[index]
        dialog = tk.Toplevel(self.root)
        dialog.title("Edit Sheet")
        dialog.configure(bg=BG_CARD)
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.resizable(False, False)

        values = {
            "sheet_number": tk.StringVar(value=sheet.get("sheet_number", "")),
            "drawing_title_1": tk.StringVar(value=sheet.get("drawing_title_1", "")),
            "filename_pattern": tk.StringVar(value=sheet.get("filename_pattern", "")),
            "scale": tk.StringVar(value=sheet.get("scale", "NTS")),
        }

        for label, key in [
            ("#", "sheet_number"),
            ("Sheet Title", "drawing_title_1"),
            ("Filename Pattern", "filename_pattern"),
            ("Scale", "scale"),
        ]:
            row = tk.Frame(dialog, bg=BG_CARD)
            row.pack(fill="x", padx=14, pady=6)
            tk.Label(
                row,
                text=label,
                bg=BG_CARD,
                fg=FG_SEC,
                font=FONT_LBL,
                width=16,
                anchor="w",
            ).pack(side="left")
            ttk.Entry(row, textvariable=values[key], width=34).pack(
                side="left", fill="x", expand=True
            )

        src_row = tk.Frame(dialog, bg=BG_CARD)
        src_row.pack(fill="x", padx=14, pady=(2, 8))
        tk.Label(
            src_row,
            text="Source Image",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LBL,
            width=16,
            anchor="w",
        ).pack(side="left")
        tk.Label(
            src_row,
            text=os.path.basename(sheet.get("source_path", "")) or "(none)",
            bg=BG_CARD,
            fg=FG_PRI,
            font=FONT_TINY,
            anchor="w",
        ).pack(side="left")

        btns = tk.Frame(dialog, bg=BG_CARD)
        btns.pack(fill="x", padx=14, pady=(0, 14))

        def save_and_close():
            sheet["sheet_number"] = values["sheet_number"].get().strip()
            sheet["drawing_title_1"] = values["drawing_title_1"].get().strip()
            sheet["filename_pattern"] = values["filename_pattern"].get().strip()
            sheet["scale"] = values["scale"].get().strip() or "NTS"
            dialog.destroy()
            self._refresh_sheet_table()

        tk.Button(
            btns,
            text="Save",
            font=FONT_TINY,
            bg=BG_ACCENT,
            fg="white",
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=save_and_close,
        ).pack(side="left")
        tk.Button(
            btns,
            text="Cancel",
            font=FONT_TINY,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=10,
            pady=4,
            cursor="hand2",
            command=dialog.destroy,
        ).pack(side="left", padx=(8, 0))

    def _move_selected_sheet(self, offset):
        if self.v_sheet_mode.get() != "manual":
            messagebox.showinfo(
                "Manual editing",
                "Switch to Selected images mode to reorder the sheet list inside the app.",
            )
            return
        index = self._get_selected_sheet_index()
        if index is None:
            messagebox.showinfo("Select a sheet", "Select a sheet row to move.")
            return
        new_index = index + offset
        if new_index < 0 or new_index >= len(self.manual_sheets):
            return
        self.manual_sheets[index], self.manual_sheets[new_index] = (
            self.manual_sheets[new_index],
            self.manual_sheets[index],
        )
        self._renumber_manual_sheets()
        self._refresh_sheet_table()
        children = self.sheet_tree.get_children()
        if 0 <= new_index < len(children):
            self.sheet_tree.selection_set(children[new_index])
            self.sheet_tree.focus(children[new_index])

    def _remove_selected_sheet(self):
        if self.v_sheet_mode.get() != "manual":
            messagebox.showinfo(
                "Manual editing",
                "Switch to Selected images mode to remove sheets inside the app.",
            )
            return
        index = self._get_selected_sheet_index()
        if index is None:
            messagebox.showinfo("Select a sheet", "Select a sheet row to remove.")
            return
        removed = self.manual_sheets.pop(index)
        self._renumber_manual_sheets()
        self._refresh_sheet_table()
        removed_name = os.path.basename(removed.get("source_path", "")) or removed.get(
            "filename_pattern", "image"
        )
        self._log(f"Removed sheet for {removed_name}")

    def _renumber_manual_sheets(self):
        for idx, sheet in enumerate(self.manual_sheets, 1):
            sheet["sheet_number"] = f"{idx:03d}"

    def _build_output_section(self, parent):
        card = self._card(parent, "Build Log")
        self.log_text = tk.Text(
            card,
            height=8,
            bg=BG_INPUT,
            fg=FG_PRI,
            font=FONT_MONO,
            relief="flat",
            insertbackground=FG_PRI,
            state="disabled",
        )
        self.log_text.pack(fill="x")
        self.progress = ttk.Progressbar(card, mode="determinate", length=400)
        self.progress.pack(fill="x", pady=(8, 0))
        self.progress_label = tk.Label(
            card, text="", bg=BG_CARD, fg=FG_SEC, font=FONT_TINY
        )
        self.progress_label.pack(anchor="w")

    def _build_run_section(self, parent):
        card = self._card(parent)
        row = tk.Frame(card, bg=BG_CARD)
        row.pack(fill="x")
        self.run_btn = tk.Button(
            row,
            text="  Build Appendix PPTX  ",
            font=("Segoe UI", 11, "bold"),
            bg=BG_ACCENT,
            fg="white",
            relief="flat",
            padx=20,
            pady=10,
            cursor="hand2",
            command=self._run_build,
        )
        self.run_btn.pack(side="left")
        self.open_btn = tk.Button(
            row,
            text="  Open Output Folder  ",
            font=FONT_LBL,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            padx=12,
            pady=10,
            cursor="hand2",
            command=self._open_output_folder,
        )
        self.open_btn.pack(side="left", padx=(12, 0))
        tk.Label(
            card,
            text="Select images, edit the sheet list in-app if needed, then build the appendix PowerPoint.",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_TINY,
        ).pack(anchor="w", pady=(8, 0))

    def _log(self, msg):
        self.log_text.configure(state="normal")
        self.log_text.insert("end", msg + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _run_build(self):
        if self._build_running:
            return

        mode = self.v_sheet_mode.get()
        exports = self.v_exports_dir.get().strip()
        output = self.v_output_path.get().strip()

        if not output:
            messagebox.showerror("Missing path", "Please specify an output .pptx path.")
            return
        if os.path.isdir(output):
            messagebox.showerror(
                "Invalid output path",
                "Output must be a full .pptx file path, not just a folder.",
            )
            return
        if not output.lower().endswith(".pptx"):
            messagebox.showerror(
                "Invalid output path", "Output file must end with .pptx"
            )
            return
        if mode in {"folder", "csv"} and (not exports or not os.path.isdir(exports)):
            messagebox.showerror(
                "Missing path", "Please select a valid exports folder."
            )
            return

        sheets = self._get_current_sheets()
        if mode == "manual" and not sheets:
            messagebox.showerror(
                "No images selected",
                "Select one or more images before building the appendix.",
            )
            return
        if mode == "folder" and not sheets:
            messagebox.showerror(
                "No images found",
                "No supported image files were found in the selected exports folder.",
            )
            return

        sheet_errors = validate_sheet_config(sheets)
        if sheet_errors:
            messagebox.showerror(
                "Invalid sheet list",
                "Please fix the sheet configuration before building:\n\n"
                + "\n".join(sheet_errors[:10]),
            )
            return

        self._build_running = True
        self.run_btn.configure(state="disabled", text="  Building...  ")
        self.open_btn.configure(state="disabled")
        self.progress["value"] = 0
        self.progress_label.configure(text="Preparing build...")

        project_config = {
            "project_title": self.v_proj_title.get(),
            "project_address": self.v_proj_addr.get(),
            "project_number": self.v_proj_number.get(),
            "client_name": self.v_client.get(),
            "drawn_by": self.v_drawn.get(),
            "designed_by": self.v_designed.get(),
            "approved_by": self.v_approved.get(),
            "date": self.v_date.get(),
            "drawing_status": self.v_status.get(),
            "sheet_prefix": self.v_prefix.get(),
            "company_name": self.v_company_name.get().strip(),
            "company_address": self.v_company_address.get().strip(),
            "company_phone": self.v_company_phone.get().strip(),
            "company_email": self.v_company_email.get().strip(),
            "company_website": self.v_company_website.get().strip(),
        }
        logo_path = (
            resolve_optional_path(
                self._loaded_config_path, self.v_logo_path.get().strip()
            )
            or None
        )
        template_path = (
            resolve_optional_path(
                self._loaded_config_path, self.v_template_path.get().strip()
            )
            or None
        )

        def progress_cb(current, total, msg):
            self._event_queue.put(("progress", current, total, msg))

        def run():
            try:
                result = build_appendix(
                    exports_dir=exports,
                    output_path=output,
                    project_config=project_config,
                    sheets=sheets,
                    logo_path=logo_path,
                    template_path=template_path,
                    on_progress=progress_cb,
                )
                self._event_queue.put(("complete", result))
            except Exception as exc:
                import traceback

                self._event_queue.put(("error", str(exc), traceback.format_exc()))

        threading.Thread(target=run, daemon=True).start()

    def _process_ui_events(self):
        try:
            while True:
                event = self._event_queue.get_nowait()
                kind = event[0]
                if kind == "progress":
                    _, current, total, msg = event
                    self.progress["value"] = (current / max(total, 1)) * 100
                    self.progress_label.configure(text=msg)
                    self._log(msg)
                elif kind == "complete":
                    self._on_build_complete(event[1])
                elif kind == "error":
                    self._on_build_error(event[1], event[2])
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self._process_ui_events)

    def _on_build_complete(self, result):
        self._build_running = False
        self.run_btn.configure(state="normal", text="  Build Appendix PPTX  ")
        self.open_btn.configure(state="normal")
        self.progress["value"] = 100

        built = result["slides_built"]
        missing = result["missing"]
        output = result["output_path"]
        self._log(f"\nBuilt {built} slides -> {output}")

        if missing:
            self._log(f"\n{len(missing)} image(s) were missing:")
            for num, title, pattern in missing:
                self._log(f"   Sheet {num} - {title}: no file matching '{pattern}'")
            messagebox.showwarning(
                "Build complete with warnings",
                (
                    f"{built} slides built.\n\n{len(missing)} image(s) were "
                    f"missing and replaced with placeholders.\n\nOutput saved "
                    f"to:\n{output}"
                ),
            )
        else:
            messagebox.showinfo(
                "Build complete",
                f"All {built} slides built successfully.\n\nOutput saved to:\n{output}",
            )

    def _on_build_error(self, msg, tb):
        self._build_running = False
        self.run_btn.configure(state="normal", text="  Build Appendix PPTX  ")
        self.open_btn.configure(state="normal")
        self._log(f"\nError: {msg}")
        self._log(tb)
        messagebox.showerror(
            "Build failed", f"An error occurred:\n{msg}\n\nSee log for details."
        )

    def _open_output_folder(self):
        path = self.v_output_path.get().strip()
        folder = os.path.dirname(path) if path else None
        if folder and os.path.isdir(folder):
            if sys.platform == "win32":
                os.startfile(folder)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])

    def _load_config(self):
        path = filedialog.askopenfilename(
            filetypes=[("JSON", "*.json")], title="Load project_config.json"
        )
        if not path:
            return
        cfg = load_project_config(path)
        self._loaded_config_path = path
        self.v_proj_title.set(cfg.get("project_title", ""))
        self.v_proj_addr.set(cfg.get("project_address", ""))
        self.v_proj_number.set(cfg.get("project_number", ""))
        self.v_client.set(cfg.get("client_name", ""))
        self.v_drawn.set(cfg.get("drawn_by", ""))
        self.v_designed.set(cfg.get("designed_by", ""))
        self.v_approved.set(cfg.get("approved_by", ""))
        self.v_date.set(cfg.get("date", ""))
        self.v_status.set(cfg.get("drawing_status", "FOR INFORMATION"))
        self.v_prefix.set(cfg.get("sheet_prefix", "A"))
        self.v_logo_path.set(cfg.get("logo_path", ""))
        self.v_template_path.set(cfg.get("template_path", ""))
        self.v_company_name.set(cfg.get("company_name", "PTG CONSULTING"))
        self.v_company_address.set(
            cfg.get(
                "company_address",
                "Level 3, 159 Coronation Drive (CNR Cribb St), Milton QLD 4064",
            )
        )
        self.v_company_phone.set(cfg.get("company_phone", "(07) 3444 6666"))
        self.v_company_email.set(cfg.get("company_email", "admin@ptgconsulting.com.au"))
        self.v_company_website.set(
            cfg.get("company_website", "www.ptgconsulting.com.au")
        )
        self._refresh_sheet_table()
        self._log(f"Loaded config: {path}")

    def _save_config(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON", "*.json")],
            title="Save project config",
        )
        if not path:
            return
        cfg = {
            "project_title": self.v_proj_title.get(),
            "project_address": self.v_proj_addr.get(),
            "project_number": self.v_proj_number.get(),
            "client_name": self.v_client.get(),
            "drawn_by": self.v_drawn.get(),
            "designed_by": self.v_designed.get(),
            "approved_by": self.v_approved.get(),
            "date": self.v_date.get(),
            "drawing_status": self.v_status.get(),
            "sheet_prefix": self.v_prefix.get(),
            "logo_path": self.v_logo_path.get(),
            "template_path": self.v_template_path.get(),
            "company_name": self.v_company_name.get(),
            "company_address": self.v_company_address.get(),
            "company_phone": self.v_company_phone.get(),
            "company_email": self.v_company_email.get(),
            "company_website": self.v_company_website.get(),
        }
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(cfg, handle, indent=2)
        self._log(f"Saved config: {path}")
        messagebox.showinfo("Saved", f"Config saved to:\n{path}")

    def _create_template_config(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            initialfile="project_config.json",
            filetypes=[("JSON", "*.json")],
            title="Save template config",
        )
        if path:
            save_default_config(path)
            self._log(f"Template config created: {path}")
            messagebox.showinfo(
                "Created",
                f"Template config saved to:\n{path}\n\nEdit it and load it for each project.",
            )

    def _create_template_csv(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            initialfile="sheets.csv",
            filetypes=[("CSV", "*.csv")],
            title="Save template sheets.csv",
        )
        if path:
            save_default_sheet_csv(path)
            self.v_sheets_csv.set(path)
            self._refresh_sheet_table()
            self._log(f"Template sheets.csv created: {path}")
            messagebox.showinfo(
                "Created",
                f"Template sheets.csv saved to:\n{path}\n\nEdit it to customise your sheet list.",
            )
