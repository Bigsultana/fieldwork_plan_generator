"""Neutral desktop interface for building engineering-image appendices."""

import json
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from datetime import date
from tkinter import filedialog, messagebox, ttk

from utils.builder import build_appendix
from utils.config_loader import (
    build_sheets_from_image_paths,
    build_sheets_from_images,
    default_project_config,
    load_project_config,
    load_sheet_config,
    resolve_optional_path,
    save_default_config,
    save_default_sheet_csv,
    validate_sheet_config,
)

APP_VERSION = "2.1.0"
BG_MAIN = "#1e2228"
BG_CARD = "#262b33"
BG_INPUT = "#1a1e24"
BG_ACCENT = "#2d6a9f"
FG_PRI = "#e8eaf0"
FG_SEC = "#9aa0ad"
FG_BRD = "#3a3f4a"
FONT_BODY = ("Segoe UI", 10)
FONT_LABEL = ("Segoe UI", 9)
FONT_SMALL = ("Segoe UI", 8)
FONT_MONO = ("Consolas", 9)


class AppendixBuilderApp:
    def __init__(self, root):
        self.root = root
        self.root.configure(bg=BG_MAIN)
        self.root.title("Appendix Builder")
        self._events = queue.Queue()
        self._build_running = False
        self._loaded_config_path = ""
        self.manual_sheets = []

        self._configure_styles()
        self._build_variables()
        self._build_ui()
        self.root.after(100, self._process_events)

    def _configure_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "TEntry",
            fieldbackground=BG_INPUT,
            foreground=FG_PRI,
            insertcolor=FG_PRI,
        )
        style.configure(
            "TCombobox",
            fieldbackground=BG_INPUT,
            foreground=FG_PRI,
        )
        style.configure(
            "Treeview",
            background=BG_INPUT,
            foreground=FG_PRI,
            fieldbackground=BG_INPUT,
        )
        style.configure(
            "Treeview.Heading",
            background=BG_CARD,
            foreground=FG_PRI,
        )
        style.configure(
            "TProgressbar",
            troughcolor=BG_INPUT,
            background=BG_ACCENT,
        )

    def _build_variables(self):
        defaults = default_project_config()
        self.fields = {
            key: tk.StringVar(value=value)
            for key, value in defaults.items()
        }
        self.fields["date"].set(date.today().strftime("%d.%m.%y"))
        self.exports_dir = tk.StringVar()
        self.output_path = tk.StringVar()
        self.sheets_csv = tk.StringVar()
        self.sheet_mode = tk.StringVar(value="manual")
        self.sheet_mode.trace_add(
            "write", lambda *_: self._refresh_sheet_table()
        )
        self.exports_dir.trace_add(
            "write", lambda *_: self._refresh_sheet_table()
        )
        self.sheets_csv.trace_add(
            "write", lambda *_: self._refresh_sheet_table()
        )

    def _build_ui(self):
        header = tk.Frame(self.root, bg=BG_ACCENT, height=46)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(
            header,
            text="  Appendix Builder",
            bg=BG_ACCENT,
            fg="white",
            font=("Segoe UI", 12, "bold"),
        ).pack(side="left", pady=11)
        tk.Label(
            header,
            text=f"v{APP_VERSION}  ",
            bg=BG_ACCENT,
            fg="#c0d8f0",
            font=FONT_SMALL,
        ).pack(side="right", pady=12)

        outer = tk.Frame(self.root, bg=BG_MAIN)
        outer.pack(fill="both", expand=True)
        canvas = tk.Canvas(outer, bg=BG_MAIN, highlightthickness=0)
        scrollbar = ttk.Scrollbar(
            outer, orient="vertical", command=canvas.yview
        )
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        body = tk.Frame(canvas, bg=BG_MAIN)
        window = canvas.create_window((0, 0), window=body, anchor="nw")
        body.bind(
            "<Configure>",
            lambda _: canvas.configure(scrollregion=canvas.bbox("all")),
        )
        canvas.bind(
            "<Configure>",
            lambda event: canvas.itemconfigure(window, width=event.width),
        )
        canvas.bind_all(
            "<MouseWheel>",
            lambda event: canvas.yview_scroll(
                -1 * (event.delta // 120), "units"
            ),
        )

        content = tk.Frame(body, bg=BG_MAIN)
        content.pack(fill="both", expand=True, padx=16, pady=12)
        self._build_project_card(content)
        self._build_company_card(content)
        self._build_files_card(content)
        self._build_sheets_card(content)
        self._build_log_card(content)
        self._build_actions_card(content)

    def _card(self, parent, title):
        border = tk.Frame(parent, bg=FG_BRD, padx=1, pady=1)
        border.pack(fill="x", pady=5)
        card = tk.Frame(border, bg=BG_CARD, padx=14, pady=12)
        card.pack(fill="both", expand=True)
        if title:
            tk.Label(
                card,
                text=title.upper(),
                bg=BG_CARD,
                fg=FG_SEC,
                font=("Segoe UI", 8, "bold"),
            ).pack(anchor="w", pady=(0, 8))
        return card

    def _entry_row(self, parent, label, variable):
        row = tk.Frame(parent, bg=BG_CARD)
        row.pack(fill="x", pady=3)
        tk.Label(
            row,
            text=label,
            width=20,
            anchor="w",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LABEL,
        ).pack(side="left")
        ttk.Entry(row, textvariable=variable).pack(
            side="left", fill="x", expand=True
        )

    def _path_row(
        self,
        parent,
        label,
        variable,
        *,
        directory=False,
        output=False,
    ):
        row = tk.Frame(parent, bg=BG_CARD)
        row.pack(fill="x", pady=3)
        tk.Label(
            row,
            text=label,
            width=20,
            anchor="w",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LABEL,
        ).pack(side="left")
        ttk.Entry(row, textvariable=variable).pack(
            side="left", fill="x", expand=True, padx=(0, 6)
        )

        def browse():
            if directory:
                selected = filedialog.askdirectory(title=label)
            elif output:
                selected = filedialog.asksaveasfilename(
                    title=label,
                    defaultextension=".pptx",
                    filetypes=[("PowerPoint", "*.pptx")],
                )
            else:
                selected = filedialog.askopenfilename(title=label)
            if selected:
                variable.set(selected)

        tk.Button(
            row,
            text="Browse",
            command=browse,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            font=FONT_SMALL,
        ).pack(side="left")

    def _build_project_card(self, parent):
        card = self._card(parent, "Project Details")
        for label, key in (
            ("Project Title", "project_title"),
            ("Project Address", "project_address"),
            ("Project Number", "project_number"),
            ("Client Name", "client_name"),
        ):
            self._entry_row(card, label, self.fields[key])

        compact = tk.Frame(card, bg=BG_CARD)
        compact.pack(fill="x", pady=5)
        for label, key, width in (
            ("Drawn By", "drawn_by", 8),
            ("Designed By", "designed_by", 8),
            ("Approved By", "approved_by", 8),
            ("Date", "date", 10),
            ("Prefix", "sheet_prefix", 6),
        ):
            column = tk.Frame(compact, bg=BG_CARD)
            column.pack(side="left", padx=(0, 12))
            tk.Label(
                column,
                text=label,
                bg=BG_CARD,
                fg=FG_SEC,
                font=FONT_SMALL,
            ).pack(anchor="w")
            ttk.Entry(
                column,
                textvariable=self.fields[key],
                width=width,
            ).pack()

        status = tk.Frame(card, bg=BG_CARD)
        status.pack(fill="x", pady=3)
        tk.Label(
            status,
            text="Drawing Status",
            width=20,
            anchor="w",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LABEL,
        ).pack(side="left")
        ttk.Combobox(
            status,
            textvariable=self.fields["drawing_status"],
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

        buttons = tk.Frame(card, bg=BG_CARD)
        buttons.pack(fill="x", pady=(8, 0))
        for label, command in (
            ("Load Config", self._load_config),
            ("Save Config", self._save_config),
            ("Create Config Template", self._create_config_template),
        ):
            tk.Button(
                buttons,
                text=label,
                command=command,
                bg=BG_INPUT,
                fg=FG_SEC,
                relief="flat",
                font=FONT_SMALL,
            ).pack(side="left", padx=(0, 8))

    def _build_company_card(self, parent):
        card = self._card(parent, "Company / Title Block")
        for label, key in (
            ("Company Name", "company_name"),
            ("Company Address", "company_address"),
            ("Phone", "company_phone"),
            ("Email", "company_email"),
            ("Website", "company_website"),
        ):
            self._entry_row(card, label, self.fields[key])

    def _build_files_card(self, parent):
        card = self._card(parent, "Files")
        self._path_row(
            card,
            "Exports Folder",
            self.exports_dir,
            directory=True,
        )
        self._path_row(card, "Logo Image", self.fields["logo_path"])
        self._path_row(
            card,
            "Template PPTX",
            self.fields["template_path"],
        )
        self._path_row(
            card,
            "Output PPTX",
            self.output_path,
            output=True,
        )

        mode = tk.Frame(card, bg=BG_CARD)
        mode.pack(fill="x", pady=(8, 0))
        tk.Label(
            mode,
            text="Sheet Source",
            width=20,
            anchor="w",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_LABEL,
        ).pack(side="left")
        for label, value in (
            ("Selected Images", "manual"),
            ("Folder Order", "folder"),
            ("CSV", "csv"),
        ):
            tk.Radiobutton(
                mode,
                text=label,
                variable=self.sheet_mode,
                value=value,
                bg=BG_CARD,
                fg=FG_PRI,
                selectcolor=BG_INPUT,
                activebackground=BG_CARD,
                activeforeground=FG_PRI,
                font=FONT_LABEL,
            ).pack(side="left", padx=(0, 12))

    def _build_sheets_card(self, parent):
        card = self._card(parent, "Sheet List")
        csv_row = tk.Frame(card, bg=BG_CARD)
        csv_row.pack(fill="x", pady=(0, 8))
        ttk.Entry(csv_row, textvariable=self.sheets_csv).pack(
            side="left", fill="x", expand=True, padx=(0, 6)
        )
        tk.Button(
            csv_row,
            text="Select CSV",
            command=self._select_csv,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            font=FONT_SMALL,
        ).pack(side="left")
        tk.Button(
            csv_row,
            text="Create CSV Template",
            command=self._create_csv_template,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            font=FONT_SMALL,
        ).pack(side="left", padx=(8, 0))

        buttons = tk.Frame(card, bg=BG_CARD)
        buttons.pack(fill="x", pady=(0, 8))
        for label, command in (
            ("Select Images", self._select_images),
            ("Edit", self._edit_sheet),
            ("Move Up", lambda: self._move_sheet(-1)),
            ("Move Down", lambda: self._move_sheet(1)),
            ("Remove", self._remove_sheet),
        ):
            tk.Button(
                buttons,
                text=label,
                command=command,
                bg=BG_INPUT,
                fg=FG_SEC,
                relief="flat",
                font=FONT_SMALL,
            ).pack(side="left", padx=(0, 8))

        columns = ("number", "title", "pattern", "scale")
        self.sheet_tree = ttk.Treeview(
            card,
            columns=columns,
            show="headings",
            height=8,
        )
        headings = (
            ("number", "#", 60),
            ("title", "Drawing Title", 340),
            ("pattern", "Filename Pattern", 250),
            ("scale", "Scale", 80),
        )
        for key, title, width in headings:
            self.sheet_tree.heading(key, text=title)
            self.sheet_tree.column(key, width=width, anchor="w")
        self.sheet_tree.pack(fill="x")
        self.sheet_tree.bind(
            "<Double-1>", lambda _: self._edit_sheet()
        )
        self._refresh_sheet_table()

    def _build_log_card(self, parent):
        card = self._card(parent, "Build Log")
        self.log = tk.Text(
            card,
            height=8,
            bg=BG_INPUT,
            fg=FG_PRI,
            font=FONT_MONO,
            relief="flat",
            state="disabled",
        )
        self.log.pack(fill="x")
        self.progress = ttk.Progressbar(card, mode="determinate")
        self.progress.pack(fill="x", pady=(8, 0))
        self.progress_label = tk.Label(
            card,
            text="",
            bg=BG_CARD,
            fg=FG_SEC,
            font=FONT_SMALL,
        )
        self.progress_label.pack(anchor="w")

    def _build_actions_card(self, parent):
        card = self._card(parent, "")
        self.build_button = tk.Button(
            card,
            text="Build Appendix PPTX",
            command=self._run_build,
            bg=BG_ACCENT,
            fg="white",
            relief="flat",
            font=("Segoe UI", 11, "bold"),
            padx=18,
            pady=9,
        )
        self.build_button.pack(side="left")
        self.open_button = tk.Button(
            card,
            text="Open Output Folder",
            command=self._open_output_folder,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
            font=FONT_LABEL,
            padx=12,
            pady=9,
        )
        self.open_button.pack(side="left", padx=(12, 0))

    def _current_sheets(self):
        mode = self.sheet_mode.get()
        if mode == "manual":
            return [dict(sheet) for sheet in self.manual_sheets]
        if mode == "folder":
            return build_sheets_from_images(
                self.exports_dir.get().strip(),
                self.fields["sheet_prefix"].get().strip() or "A",
            )
        return load_sheet_config(self.sheets_csv.get().strip())

    def _refresh_sheet_table(self):
        if not hasattr(self, "sheet_tree"):
            return
        for item in self.sheet_tree.get_children():
            self.sheet_tree.delete(item)
        try:
            sheets = self._current_sheets()
        except Exception:
            sheets = []
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

    def _selected_index(self):
        selection = self.sheet_tree.selection()
        return self.sheet_tree.index(selection[0]) if selection else None

    def _select_images(self):
        paths = filedialog.askopenfilenames(
            title="Select appendix images",
            filetypes=[
                ("Images", "*.jpg *.jpeg *.png *.tif *.tiff *.bmp"),
                ("All files", "*.*"),
            ],
        )
        if paths:
            self.manual_sheets = build_sheets_from_image_paths(list(paths))
            self.sheet_mode.set("manual")
            self._refresh_sheet_table()

    def _select_csv(self):
        path = filedialog.askopenfilename(
            title="Select sheets CSV",
            filetypes=[("CSV", "*.csv")],
        )
        if path:
            self.sheets_csv.set(path)
            self.sheet_mode.set("csv")

    def _edit_sheet(self):
        if self.sheet_mode.get() != "manual":
            messagebox.showinfo(
                "Manual mode required",
                "Switch to Selected Images to edit sheets in the application.",
            )
            return
        index = self._selected_index()
        if index is None:
            messagebox.showinfo(
                "Select a sheet", "Select a sheet row to edit."
            )
            return
        sheet = self.manual_sheets[index]
        dialog = tk.Toplevel(self.root)
        dialog.title("Edit Sheet")
        dialog.configure(bg=BG_CARD)
        dialog.transient(self.root)
        dialog.grab_set()
        variables = {
            key: tk.StringVar(value=sheet.get(key, ""))
            for key in (
                "sheet_number",
                "drawing_title_1",
                "drawing_title_2",
                "drawing_title_3",
                "scale",
            )
        }
        for label, key in (
            ("Sheet Number", "sheet_number"),
            ("Title", "drawing_title_1"),
            ("Subtitle", "drawing_title_2"),
            ("Third Line", "drawing_title_3"),
            ("Scale", "scale"),
        ):
            row = tk.Frame(dialog, bg=BG_CARD)
            row.pack(fill="x", padx=14, pady=5)
            tk.Label(
                row,
                text=label,
                width=14,
                anchor="w",
                bg=BG_CARD,
                fg=FG_SEC,
            ).pack(side="left")
            ttk.Entry(
                row,
                textvariable=variables[key],
                width=42,
            ).pack(side="left")

        def save():
            for key, variable in variables.items():
                sheet[key] = variable.get().strip()
            dialog.destroy()
            self._refresh_sheet_table()

        tk.Button(
            dialog,
            text="Save",
            command=save,
            bg=BG_ACCENT,
            fg="white",
            relief="flat",
        ).pack(side="left", padx=14, pady=12)
        tk.Button(
            dialog,
            text="Cancel",
            command=dialog.destroy,
            bg=BG_INPUT,
            fg=FG_SEC,
            relief="flat",
        ).pack(side="left", pady=12)

    def _move_sheet(self, offset):
        if self.sheet_mode.get() != "manual":
            return
        index = self._selected_index()
        if index is None:
            return
        target = index + offset
        if target < 0 or target >= len(self.manual_sheets):
            return
        self.manual_sheets[index], self.manual_sheets[target] = (
            self.manual_sheets[target],
            self.manual_sheets[index],
        )
        for position, sheet in enumerate(self.manual_sheets, 1):
            sheet["sheet_number"] = f"{position:03d}"
        self._refresh_sheet_table()
        children = self.sheet_tree.get_children()
        self.sheet_tree.selection_set(children[target])

    def _remove_sheet(self):
        if self.sheet_mode.get() != "manual":
            return
        index = self._selected_index()
        if index is not None:
            self.manual_sheets.pop(index)
            for position, sheet in enumerate(self.manual_sheets, 1):
                sheet["sheet_number"] = f"{position:03d}"
            self._refresh_sheet_table()

    def _project_config(self):
        return {
            key: variable.get().strip()
            for key, variable in self.fields.items()
            if key not in {"logo_path", "template_path"}
        }

    def _run_build(self):
        if self._build_running:
            return
        output = self.output_path.get().strip()
        if not output.lower().endswith(".pptx"):
            messagebox.showerror(
                "Invalid output",
                "Select an output path ending in .pptx.",
            )
            return
        if os.path.exists(output) and not messagebox.askyesno(
            "Replace output?",
            f"The file already exists:\n{output}\n\nReplace it?",
        ):
            return
        try:
            sheets = self._current_sheets()
        except Exception as exc:
            messagebox.showerror("Sheet configuration error", str(exc))
            return
        errors = validate_sheet_config(sheets)
        if errors:
            messagebox.showerror(
                "Invalid sheet list", "\n".join(errors[:10])
            )
            return

        self._build_running = True
        self.build_button.configure(state="disabled", text="Building...")
        self.open_button.configure(state="disabled")
        self.progress["value"] = 0

        logo_path = (
            resolve_optional_path(
                self._loaded_config_path,
                self.fields["logo_path"].get().strip(),
            )
            or None
        )
        template_path = (
            resolve_optional_path(
                self._loaded_config_path,
                self.fields["template_path"].get().strip(),
            )
            or None
        )
        exports_dir = self.exports_dir.get().strip()

        def progress(current, total, message):
            self._events.put(
                ("progress", current, total, message)
            )

        def worker():
            try:
                result = build_appendix(
                    exports_dir,
                    output,
                    self._project_config(),
                    sheets,
                    logo_path,
                    template_path,
                    progress,
                )
                self._events.put(("complete", result))
            except Exception as exc:
                self._events.put(("error", str(exc)))

        threading.Thread(target=worker, daemon=True).start()

    def _process_events(self):
        try:
            while True:
                event = self._events.get_nowait()
                kind = event[0]
                if kind == "progress":
                    _, current, total, message = event
                    self.progress["value"] = (
                        current / max(total, 1) * 100
                    )
                    self.progress_label.configure(text=message)
                    self._write_log(message)
                elif kind == "complete":
                    self._finish_build(event[1])
                elif kind == "error":
                    self._fail_build(event[1])
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self._process_events)

    def _finish_build(self, result):
        self._reset_build_controls()
        self.progress["value"] = 100
        self._write_log(
            f"Built {result['slides_built']} slides: "
            f"{result['output_path']}"
        )
        if result["missing"]:
            messagebox.showwarning(
                "Build complete with warnings",
                f"Built {result['slides_built']} slides. "
                f"{len(result['missing'])} image(s) were replaced "
                "with placeholders.",
            )
        else:
            messagebox.showinfo(
                "Build complete",
                f"Built {result['slides_built']} slides.\n\n"
                f"{result['output_path']}",
            )

    def _fail_build(self, message):
        self._reset_build_controls()
        self._write_log(f"ERROR: {message}")
        messagebox.showerror("Build failed", message)

    def _reset_build_controls(self):
        self._build_running = False
        self.build_button.configure(
            state="normal", text="Build Appendix PPTX"
        )
        self.open_button.configure(state="normal")

    def _write_log(self, message):
        self.log.configure(state="normal")
        self.log.insert("end", message + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _open_output_folder(self):
        output = self.output_path.get().strip()
        folder = os.path.dirname(output)
        if not folder or not os.path.isdir(folder):
            return
        if sys.platform == "win32":
            os.startfile(folder)
        elif sys.platform == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])

    def _load_config(self):
        path = filedialog.askopenfilename(
            title="Load project configuration",
            filetypes=[("JSON", "*.json")],
        )
        if not path:
            return
        try:
            config = load_project_config(path)
        except Exception as exc:
            messagebox.showerror(
                "Unable to load configuration", str(exc)
            )
            return
        self._loaded_config_path = path
        for key, variable in self.fields.items():
            variable.set(config.get(key, ""))
        self._write_log(f"Loaded configuration: {path}")

    def _save_config(self):
        path = filedialog.asksaveasfilename(
            title="Save project configuration",
            defaultextension=".json",
            filetypes=[("JSON", "*.json")],
        )
        if not path:
            return
        config = self._project_config()
        config["logo_path"] = self.fields["logo_path"].get().strip()
        config["template_path"] = (
            self.fields["template_path"].get().strip()
        )
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(config, handle, indent=2)
        self._loaded_config_path = path
        self._write_log(f"Saved configuration: {path}")

    def _create_config_template(self):
        path = filedialog.asksaveasfilename(
            title="Create configuration template",
            initialfile="project_config.json",
            defaultextension=".json",
            filetypes=[("JSON", "*.json")],
        )
        if path:
            save_default_config(path)
            messagebox.showinfo(
                "Created",
                f"Configuration template saved to:\n{path}",
            )

    def _create_csv_template(self):
        path = filedialog.asksaveasfilename(
            title="Create sheet CSV template",
            initialfile="sheets.csv",
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv")],
        )
        if path:
            save_default_sheet_csv(path)
            self.sheets_csv.set(path)
            messagebox.showinfo(
                "Created",
                f"Sheet CSV template saved to:\n{path}",
            )
