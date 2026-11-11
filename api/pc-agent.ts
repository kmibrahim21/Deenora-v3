import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const supabase = getSupabaseAdmin();

// Common Bengali/Islamic Name Transliteration for ZKTeco LCD
const BN_TO_EN_NAME_MAP: Record<string, string> = {
  'মোঃ': 'MD.', 'মো:': 'MD.', 'মুহাম্মদ': 'MD.', 'মোহাম্মদ': 'MD.',
  'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
  'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
  'আলী': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
  'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
  'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
  'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
  'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH',
  'মারুফ': 'MARUF', 'রাব্বি': 'RABBI', 'ফাহিম': 'FAHIM', 'আলম': 'ALAM',
  'জান্নাত': 'JANNAT', 'ফাতেমা': 'FATEMA', 'আয়েশা': 'AYESHA', 'খাদিজা': 'KHADIJA'
};

function transliterateBnToEn(text?: string | null): string {
  if (!text || typeof text !== 'string') return 'STUDENT';
  let clean = text.trim();
  if (!clean) return 'STUDENT';

  for (const [bn, en] of Object.entries(BN_TO_EN_NAME_MAP)) {
    clean = clean.split(bn).join(en);
  }

  clean = clean.replace(/[^A-Za-z0-9\s._-]/g, '').replace(/\s+/g, ' ').trim();
  return clean ? clean.toUpperCase() : 'STUDENT';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const institutionId = (query.institution_id || query.institutionId || query.inst || '').toString().trim();
  const deviceIp = (query.device_ip || query.deviceIp || '192.168.0.201').toString().trim();
  const format = (query.format || 'exe').toString().trim().toLowerCase();

  const serverHost = req.headers.host || 'deenora.app';
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.headers.referer?.startsWith('https') ? 'https' : 'http';
  const serverUrl = `${protocol}://${serverHost}`;

  // Fetch institution name if available
  let institutionName = 'Deenora Madrasah';
  if (institutionId) {
    try {
      const { data: inst } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', institutionId)
        .maybeSingle();
      if (inst?.name) {
        institutionName = inst.name;
      }
    } catch {
      // ignore
    }
  }

  // =========================================================================
  // 1. ZKTeco USB Pen Drive Export (user.dat 72-Byte Binary Format)
  // =========================================================================
  if (format === 'usb' || format === 'dat') {
    try {
      const { data: students } = await supabase
        .from('students')
        .select('id, student_name, name_en, roll, biometric_id, is_active')
        .eq('institution_id', institutionId)
        .order('roll', { ascending: true });

      const studentList = students || [];
      const RECORD_SIZE = 72;
      const buffer = Buffer.alloc(studentList.length * RECORD_SIZE);

      studentList.forEach((st: any, idx: number) => {
        const offset = idx * RECORD_SIZE;
        const pin = st.roll && !isNaN(Number(st.roll)) ? Number(st.roll) : idx + 1;
        const bioId = (st.biometric_id || st.roll || String(pin)).toString().trim();
        const rawName = st.name_en || st.student_name || 'STUDENT';
        const cleanName = transliterateBnToEn(rawName).substring(0, 23);

        // 1. PIN (U16, 2 bytes, little-endian)
        buffer.writeUInt16LE(pin & 0xffff, offset + 0);
        // 2. Privilege (U8, 1 byte) = 0 (Normal User)
        buffer.writeUInt8(0, offset + 2);
        // 3. Password (char[8]) = 0 (offset 3 to 10)
        // 4. Name (char[24], offset 11 to 34)
        buffer.write(cleanName, offset + 11, cleanName.length, 'ascii');
        // 5. Card (U8[4], offset 35 to 38) = 0
        // 6. Group (U8, offset 39) = 1 (Default Group)
        buffer.writeUInt8(1, offset + 39);
        // 7. TimeZones (U16[4], offset 40 to 47) = 0
        // 8. PIN2 (char[24], offset 48 to 71) = Alphanumeric user_id/biometric_id
        buffer.write(bioId.substring(0, 23), offset + 48, bioId.substring(0, 23).length, 'ascii');
      });

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="user.dat"');
      return res.status(200).send(buffer);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to generate user.dat', details: err.message });
    }
  }

  // =========================================================================
  // 2. Full Standalone Python Tkinter Desktop GUI Application (.pyw)
  // =========================================================================
  const pythonGuiScript = `# -*- coding: utf-8 -*-
"""
Deenora SaaS ZKTeco K40/K14 Sync Manager
Native Desktop GUI Application
"""

import sys
import os
import time
import subprocess
import threading
from datetime import datetime, timedelta

def ensure_package(pkg, mod=None):
    if not mod:
        mod = pkg
    try:
        __import__(mod)
    except ImportError:
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", pkg, "--quiet"], check=True)
            __import__(mod)
        except Exception:
            pass

ensure_package("requests")
ensure_package("pyzk", "zk")

import requests
from zk import ZK
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

INSTITUTION_ID = "${institutionId}"
INSTITUTION_NAME = "${institutionName.replace(/"/g, '\\"')}"
SERVER_URL = "${serverUrl}"
DEFAULT_IP = "${deviceIp}"
DEFAULT_PORT = 4370

BN_TO_EN_MAP = {
    'মোঃ': 'MD.', 'মো:': 'MD.', 'মুহাম্মদ': 'MD.', 'মোহাম্মদ': 'MD.',
    'আব্দুল্লাহ': 'ABDULLAH', 'আবদুল্লাহ': 'ABDULLAH', 'আব্দুর': 'ABDUR', 'রহমান': 'RAHMAN', 'রহিম': 'RAHIM',
    'করিম': 'KARIM', 'হাসান': 'HASAN', 'হোসাইন': 'HOSSAIN', 'হুসাইন': 'HOSSAIN',
    'আলী': 'ALI', 'আহমেদ': 'AHMED', 'মাহমুদ': 'MAHMUD', 'ইব্রাহিম': 'IBRAHIM',
    'খলিল': 'KHALIL', 'ইসমাইল': 'ISMAIL', 'ইউসুফ': 'YOUSUF', 'ইউনুস': 'YUNUS',
    'ফারুক': 'FARUK', 'ওমর': 'OMAR', 'উসমান': 'USMAN', 'আবু': 'ABU', 'বকর': 'BAKR',
    'শাকিল': 'SHAKIL', 'নাঈম': 'NAEEM', 'তানভীর': 'TANVIR', 'সাইফুল': 'SAIFUL',
    'ইসলাম': 'ISLAM', 'হোসেন': 'HOSSAIN', 'খান': 'KHAN', 'শেখ': 'SHEIKH'
}

def clean_student_name(name):
    if not name:
        return 'STUDENT'
    s = str(name).strip()
    for bn, en in BN_TO_EN_MAP.items():
        s = s.replace(bn, en)
    import re
    s = re.sub(r'[^A-Za-z0-9\\s._-]', '', s)
    s = re.sub(r'\\s+', ' ', s).strip()
    return (s.upper() if s else 'STUDENT')[:24]

class DeenoraBiometricApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Deenora - ZKTeco K40/K14 Sync Manager")
        self.geometry("760x600")
        self.minsize(700, 560)
        self.configure(bg="#0F172A")
        
        self.sync_running = False
        self.sync_thread = None
        self.synced_keys = set()
        self.zk_conn = None

        self.setup_ui()
        self.check_cloud_connection_async()

    def setup_ui(self):
        style = ttk.Style(self)
        style.theme_use('clam')
        style.configure(".", background="#0F172A", foreground="#F8FAFC", font=("Segoe UI", 9))
        style.configure("TProgressbar", thickness=16, troughcolor="#1E293B", background="#10B981")

        # 1. Header Frame
        header = tk.Frame(self, bg="#1E1B4B", padx=20, pady=16)
        header.pack(fill=tk.X)

        title_box = tk.Frame(header, bg="#1E1B4B")
        title_box.pack(side=tk.LEFT, fill=tk.Y)

        lbl_logo = tk.Label(title_box, text="﷽  DEENORA BIOMETRIC SYNC", font=("Segoe UI", 12, "bold"), fg="#A5B4FC", bg="#1E1B4B")
        lbl_logo.pack(anchor="w")

        lbl_inst = tk.Label(title_box, text=INSTITUTION_NAME, font=("Segoe UI", 15, "bold"), fg="#FFFFFF", bg="#1E1B4B")
        lbl_inst.pack(anchor="w", pady=(2, 0))

        lbl_sub = tk.Label(title_box, text="ZKTeco K40/K14 Biometric Machine Management Platform", font=("Segoe UI", 9), fg="#94A3B8", bg="#1E1B4B")
        lbl_sub.pack(anchor="w")

        # 2. Status Pills Bar
        status_bar = tk.Frame(self, bg="#1E293B", padx=16, pady=10)
        status_bar.pack(fill=tk.X, padx=16, pady=(12, 0))

        self.pill_cloud = tk.Label(status_bar, text="🟢 ক্লাউড: চেকিং...", font=("Segoe UI", 9, "bold"), fg="#E2E8F0", bg="#334155", padx=10, pady=4)
        self.pill_cloud.pack(side=tk.LEFT, padx=(0, 10))

        self.pill_machine = tk.Label(status_bar, text="🟡 মেশিন: অপ্রস্তুত", font=("Segoe UI", 9, "bold"), fg="#E2E8F0", bg="#334155", padx=10, pady=4)
        self.pill_machine.pack(side=tk.LEFT)

        # IP Settings inline on right
        ip_frame = tk.Frame(status_bar, bg="#1E293B")
        ip_frame.pack(side=tk.RIGHT)

        tk.Label(ip_frame, text="মেশিন IP:", fg="#CBD5E1", bg="#1E293B", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=4)
        self.ent_ip = tk.Entry(ip_frame, width=14, font=("Consolas", 10, "bold"), bg="#0F172A", fg="#38BDF8", insertbackground="white", bd=1, relief="solid")
        self.ent_ip.insert(0, DEFAULT_IP)
        self.ent_ip.pack(side=tk.LEFT, padx=4)

        btn_test = tk.Button(ip_frame, text="🔌 টেস্ট", font=("Segoe UI", 9, "bold"), bg="#4F46E5", fg="white", activebackground="#4338CA", activeforeground="white", bd=0, padx=8, pady=2, cursor="hand2", command=self.test_machine_connection_async)
        btn_test.pack(side=tk.LEFT, padx=4)

        # 3. Primary Action Buttons Container
        actions_container = tk.Frame(self, bg="#0F172A")
        actions_container.pack(fill=tk.X, padx=16, pady=12)

        # Action 1 Card: Upload Students
        card1 = tk.Frame(actions_container, bg="#1E293B", padx=14, pady=12, highlightbackground="#334155", highlightthickness=1)
        card1.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 6))

        tk.Label(card1, text="১. মেশিনে শিক্ষার্থী আপলোড", font=("Segoe UI", 10, "bold"), fg="#34D399", bg="#1E293B").pack(anchor="w")
        tk.Label(card1, text="সফটওয়্যার থেকে সব শিক্ষার্থীর নাম ও রোল সরাসরি K40 মেশিনে পাঠান", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B").pack(anchor="w", pady=(2, 8))

        self.btn_upload = tk.Button(card1, text="📥 মেশিনে শিক্ষার্থী আপলোড করুন", font=("Segoe UI", 10, "bold"), bg="#059669", fg="white", activebackground="#047857", activeforeground="white", bd=0, pady=8, cursor="hand2", command=self.start_upload_students)
        self.btn_upload.pack(fill=tk.X)

        self.progress = ttk.Progressbar(card1, style="TProgressbar", mode="determinate")
        self.progress.pack(fill=tk.X, pady=(8, 2))
        self.lbl_progress = tk.Label(card1, text="প্রস্তুত", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B")
        self.lbl_progress.pack(anchor="w")

        # Action 2 Card: Live Punch Sync
        card2 = tk.Frame(actions_container, bg="#1E293B", padx=14, pady=12, highlightbackground="#334155", highlightthickness=1)
        card2.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(6, 0))

        tk.Label(card2, text="২. লাইভ হাজিরা সিঙ্ক সার্ভিস", font=("Segoe UI", 10, "bold"), fg="#818CF8", bg="#1E293B").pack(anchor="w")
        tk.Label(card2, text="মেশিনে ফিঙ্গারপ্রিন্ট দেওয়া মাত্রই স্বয়ংক্রিয়ভাবে ডিইনোরায় হাজিরা যুক্ত হবে", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B").pack(anchor="w", pady=(2, 8))

        btn_row = tk.Frame(card2, bg="#1E293B")
        btn_row.pack(fill=tk.X)

        self.btn_sync = tk.Button(btn_row, text="▶️ লাইভ সিঙ্ক শুরু করুন", font=("Segoe UI", 10, "bold"), bg="#4F46E5", fg="white", activebackground="#4338CA", activeforeground="white", bd=0, pady=8, cursor="hand2", command=self.toggle_sync)
        self.btn_sync.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 4))

        btn_min = tk.Button(btn_row, text="🗕 ট্রে-তে রাখুন", font=("Segoe UI", 9, "bold"), bg="#334155", fg="#E2E8F0", activebackground="#475569", activeforeground="white", bd=0, pady=8, padx=8, cursor="hand2", command=self.iconify)
        btn_min.pack(side=tk.RIGHT)

        self.lbl_sync_status = tk.Label(card2, text="সিঙ্ক সার্ভিস বন্ধ রয়েছে", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B")
        self.lbl_sync_status.pack(anchor="w", pady=(8, 2))

        # 4. Live Activity Log Section
        log_header = tk.Frame(self, bg="#0F172A", padx=16)
        log_header.pack(fill=tk.X, pady=(4, 4))

        tk.Label(log_header, text="📋 লাইভ পাঞ্চ ও অ্যাক্টিভিটি লগ (Live Activity Log):", font=("Segoe UI", 9, "bold"), fg="#CBD5E1", bg="#0F172A").pack(side=tk.LEFT)
        btn_clear = tk.Button(log_header, text="লগ মুছুন", font=("Segoe UI", 8), fg="#94A3B8", bg="#1E293B", bd=0, padx=6, cursor="hand2", command=self.clear_log)
        btn_clear.pack(side=tk.RIGHT)

        log_frame = tk.Frame(self, bg="#0F172A", padx=16, pady=(0, 16))
        log_frame.pack(fill=tk.BOTH, expand=True)

        self.txt_log = scrolledtext.ScrolledText(log_frame, bg="#020617", fg="#34D399", font=("Consolas", 9), bd=1, relief="solid", insertbackground="white")
        self.txt_log.pack(fill=tk.BOTH, expand=True)
        self.log("✅ Deenora Biometric Sync Manager সফলভাবে চালু হয়েছে।")

    def log(self, msg):
        now = datetime.now().strftime("%I:%M:%S %p")
        self.txt_log.insert(tk.END, f"[{now}] {msg}\\n")
        self.txt_log.see(tk.END)

    def clear_log(self):
        self.txt_log.delete("1.0", tk.END)

    def check_cloud_connection_async(self):
        def task():
            try:
                res = requests.get(f"{SERVER_URL}/api/iclock?sn=PC_AGENT_{INSTITUTION_ID}&institution_id={INSTITUTION_ID}", timeout=8)
                if res.status_code == 200:
                    self.pill_cloud.config(text="🟢 ক্লাউড: সংযুক্ত", bg="#065F46", fg="#A7F3D0")
                    self.log(f"সার্ভার কানেকশন ভেরিফাইড ({SERVER_URL})")
                else:
                    self.pill_cloud.config(text="🟡 ক্লাউড: রেসপন্স কোড " + str(res.status_code), bg="#854D0E", fg="#FEF08A")
            except Exception as e:
                self.pill_cloud.config(text="🔴 ক্লাউড: সংযোগ ব্যর্থ", bg="#991B1B", fg="#FECACA")
                self.log(f"সার্ভার কানেকশন এরর: {e}")
        threading.Thread(target=task, daemon=True).start()

    def test_machine_connection_async(self):
        target_ip = self.ent_ip.get().strip() or DEFAULT_IP
        def task():
            self.log(f"মেশিন সংযোগ পরীক্ষা করা হচ্ছে ({target_ip}:{DEFAULT_PORT})...")
            try:
                zk = ZK(target_ip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=False, ommit_ping=True)
                conn = zk.connect()
                conn.disconnect()
                self.pill_machine.config(text=f"🟢 মেশিন: সংযুক্ত ({target_ip})", bg="#065F46", fg="#A7F3D0")
                self.log(f"✅ ZKTeco K40 মেশিনের সাথে সফলভাবে কানেক্ট হয়েছে! ({target_ip})")
                messagebox.showinfo("সফল সংযোগ", f"ZKTeco মেশিনের সাথে সফলভাবে সংযোগ স্থাপিত হয়েছে!\\nIP: {target_ip}:{DEFAULT_PORT}")
            except Exception:
                try:
                    zk = ZK(target_ip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=True, ommit_ping=True)
                    conn = zk.connect()
                    conn.disconnect()
                    self.pill_machine.config(text=f"🟢 মেশিন: সংযুক্ত (UDP {target_ip})", bg="#065F46", fg="#A7F3D0")
                    self.log(f"✅ ZKTeco K40 মেশিনের সাথে সংযুক্ত হয়েছে (UDP)! ({target_ip})")
                    messagebox.showinfo("সফল সংযোগ", f"ZKTeco মেশিনের সাথে UDP মোডে সফলভাবে সংযোগ স্থাপিত হয়েছে!\\nIP: {target_ip}:{DEFAULT_PORT}")
                except Exception as err:
                    self.pill_machine.config(text="🔴 মেশিন: পাওয়া যায়নি", bg="#991B1B", fg="#FECACA")
                    self.log(f"❌ মেশিনের সাথে কানেক্ট করা যায়নি ({target_ip}): {err}")
                    messagebox.showerror("কানেকশন ব্যর্থ", f"মেশিনে কানেক্ট করা যায়নি!\\nঅনুগ্রহ করে নিশ্চিত করুন:\\n১. মেশিন চালু আছে।\\n২. পিসি ও মেশিন একই রাউটারে যুক্ত।\\n৩. আইপি সঠিক আছে ({target_ip})।")
        threading.Thread(target=task, daemon=True).start()

    def start_upload_students(self):
        target_ip = self.ent_ip.get().strip() or DEFAULT_IP
        self.btn_upload.config(state=tk.DISABLED)
        self.lbl_progress.config(text="শিক্ষার্থীদের তালিকা সার্ভার থেকে আনা হচ্ছে...")
        self.progress["value"] = 0

        def task():
            try:
                self.log(f"সার্ভার থেকে শিক্ষার্থীদের ডাটা ফেচ করা হচ্ছে...")
                res = requests.get(f"{SERVER_URL}/api/biometric-upload?institution_id={INSTITUTION_ID}&format=json", timeout=15)
                if res.status_code != 200:
                    raise Exception(f"সার্ভার স্ট্যাটাস কোড {res.status_code}")
                data = res.json()
                users = data.get("users", [])
                if not users:
                    self.log("⚠️ কোনো শিক্ষার্থী বা শিক্ষকের ডাটা পাওয়া যায়নি।")
                    self.lbl_progress.config(text="কোনো শিক্ষার্থী পাওয়া যায়নি")
                    self.btn_upload.config(state=tk.NORMAL)
                    return

                total = len(users)
                self.log(f"মোট {total} জন ইউজার পাওয়া গেছে। K40 মেশিনে আপলোড শুরু হচ্ছে...")
                self.lbl_progress.config(text=f"মেশিনে সংযোগ করা হচ্ছে ({target_ip})...")

                conn = None
                try:
                    zk = ZK(target_ip, port=DEFAULT_PORT, timeout=5, password=0, force_udp=False, ommit_ping=True)
                    conn = zk.connect()
                except Exception:
                    zk = ZK(target_ip, port=DEFAULT_PORT, timeout=5, password=0, force_udp=True, ommit_ping=True)
                    conn = zk.connect()

                success_count = 0
                for idx, u in enumerate(users, 1):
                    raw_name = u.get("name", "STUDENT")
                    clean_name = clean_student_name(raw_name)
                    uid_val = int(u.get("uid", idx))
                    user_id_val = str(u.get("user_id", uid_val))

                    try:
                        conn.set_user(uid=uid_val, name=clean_name, privilege=0, password='', group_id='', user_id=user_id_val, card=0)
                        success_count += 1
                        self.log(f"[{idx}/{total}] [OK] রোল/আইডি: {user_id_val} | নাম: {clean_name}")
                    except Exception as u_err:
                        self.log(f"[{idx}/{total}] [FAIL] আইডি: {user_id_val} -> {u_err}")

                    pct = int((idx / total) * 100)
                    self.progress["value"] = pct
                    self.lbl_progress.config(text=f"আপলোড হচ্ছে: {idx}/{total} ({clean_name}) - {pct}%")

                conn.disconnect()
                self.log(f"🎉 সম্পন্ন! মোট {success_count} জন সফলভাবে মেশিনে আপলোড হয়েছে।")
                self.lbl_progress.config(text=f"✅ সফলভাবে {success_count}/{total} জন আপলোড সম্পন্ন!")
                messagebox.showinfo("আপলোড সম্পন্ন", f"🎉 অভিনন্দন!\\n\\nমোট {success_count} জন শিক্ষার্থীর তথ্য ZKTeco K40 মেশিনের মেমোরিতে সফলভাবে আপলোড হয়েছে।\\nএখন শিক্ষার্থীরা মেশিনে ফিঙ্গারপ্রিন্ট রেজিস্টার করতে পারবে।")
            except Exception as e:
                self.log(f"❌ আপলোড ব্যর্থ: {e}")
                self.lbl_progress.config(text="আপলোড ব্যর্থ হয়েছে")
                messagebox.showerror("এরর", f"আপলোড ব্যর্থ হয়েছে:\\n{e}")
            finally:
                self.btn_upload.config(state=tk.NORMAL)

        threading.Thread(target=task, daemon=True).start()

    def toggle_sync(self):
        if self.sync_running:
            self.sync_running = False
            self.btn_sync.config(text="▶️ লাইভ সিঙ্ক শুরু করুন", bg="#4F46E5")
            self.lbl_sync_status.config(text="সিঙ্ক সার্ভিস বন্ধ রয়েছে", fg="#94A3B8")
            self.log("⏹️ লাইভ সিঙ্ক সার্ভিস বন্ধ করা হয়েছে।")
        else:
            self.sync_running = True
            self.btn_sync.config(text="⏹️ সিঙ্ক বন্ধ করুন", bg="#E11D48")
            self.lbl_sync_status.config(text="🟢 লাইভ সিঙ্ক ব্যাকগ্রাউন্ডে চলছে...", fg="#34D399")
            self.log("🚀 লাইভ সিঙ্ক সার্ভিস চালু হয়েছে। প্রতি ৩ সেকেন্ড পর পর পাঞ্চ চেক করা হচ্ছে...")
            self.sync_thread = threading.Thread(target=self.run_sync_loop, daemon=True)
            self.sync_thread.start()

    def run_sync_loop(self):
        target_ip = self.ent_ip.get().strip() or DEFAULT_IP
        while self.sync_running:
            try:
                zk = ZK(target_ip, port=DEFAULT_PORT, timeout=4, password=0, force_udp=False, ommit_ping=True)
                conn = zk.connect()
                try:
                    conn.set_time(datetime.now())
                except:
                    pass

                self.pill_machine.config(text=f"🟢 মেশিন: লাইভ ({target_ip})", bg="#065F46", fg="#A7F3D0")

                while self.sync_running:
                    attendances = conn.get_attendance()
                    if attendances:
                        cutoff = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
                        new_logs = []
                        for att in attendances:
                            t_str = str(att.timestamp)
                            if t_str[:10] >= cutoff:
                                k = f"{att.user_id}_{t_str}"
                                if k not in self.synced_keys:
                                    new_logs.append({"userId": str(att.user_id), "checkTime": t_str})

                        if new_logs:
                            payload = {
                                "institution_id": INSTITUTION_ID,
                                "sn": f"PC_AGENT_{INSTITUTION_ID}",
                                "logs": new_logs
                            }
                            res = requests.post(f"{SERVER_URL}/api/iclock", json=payload, headers={"X-Institution-Id": INSTITUTION_ID}, timeout=(8, 20))
                            if res.status_code == 200:
                                for l in new_logs:
                                    self.synced_keys.add(f"{l['userId']}_{l['checkTime']}")
                                    self.log(f"🔔 [পাঞ্চ রিসিভড] রোল/আইডি {l['userId']} সময়: {l['checkTime']} -> Deenora-তে উপস্থিত সংরক্ষিত হয়েছে।")
                            else:
                                self.log(f"⚠️ সার্ভার রেসপন্স কোড {res.status_code}")

                    time.sleep(3)

                conn.disconnect()
            except Exception as e:
                if self.sync_running:
                    self.log(f"⚠️ মেশিন সংযোগ বিচ্ছিন্ন ({e})। ৫ সেকেন্ডে পুনরায় চেষ্টা করা হচ্ছে...")
                    self.pill_machine.config(text="🟡 মেশিন: রিকানেক্টিং...", bg="#854D0E", fg="#FEF08A")
                    time.sleep(5)

if __name__ == "__main__":
    app = DeenoraBiometricApp()
    app.mainloop()
`;

  // Return raw Python Tkinter GUI script if requested
  if (format === 'pyw' || format === 'py') {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DeenoraBiometricManager_${institutionId || 'Setup'}.pyw"`);
    return res.status(200).send(pythonGuiScript);
  }

  // =========================================================================
  // 3. Native Windows Standalone Executable (.exe) Packaging
  // =========================================================================
  const stubPath = path.join(process.cwd(), 'public', 'DeenoraBiometricSetup_stub.exe');
  const libStubPath = path.join(process.cwd(), 'lib', 'DeenoraBiometricSetup_stub.exe');
  const effectiveStubPath = fs.existsSync(stubPath) ? stubPath : (fs.existsSync(libStubPath) ? libStubPath : null);

  if (effectiveStubPath && fs.existsSync(effectiveStubPath)) {
    try {
      const stubBuffer = fs.readFileSync(effectiveStubPath);
      const payloadString = `\n###DEENORA_PAYLOAD_START###\n${pythonGuiScript}\n###DEENORA_PAYLOAD_END###\n`;
      const payloadBuffer = Buffer.from(payloadString, 'utf-8');
      const fullExeBuffer = Buffer.concat([stubBuffer, payloadBuffer]);

      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader('Content-Disposition', 'attachment; filename="DeenoraBiometricSetup.exe"');
      return res.status(200).send(fullExeBuffer);
    } catch (err: any) {
      console.error('[PC Agent] Failed to read or package stub.exe:', err);
    }
  }

  // Fallback: If stub is somehow missing, return the standalone GUI script with instructions
  res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="DeenoraBiometricManager.pyw"');
  return res.status(200).send(pythonGuiScript);
}
