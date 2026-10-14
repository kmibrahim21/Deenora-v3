# WhatsApp / imo-স্টাইল প্রফেশনাল ভয়েস কল আর্কিটেকচার ইমপ্লিমেন্টেশন প্ল্যান

WhatsApp ও imo-এর মতো স্মুথ, হাই-কোয়ালিটি এবং ব্যাকগ্রাউন্ড ও লক স্ক্রিন থেকে রিং হওয়ার মতো নির্ভরযোগ্য কলিং ব্যবস্থা নিশ্চিত করতে ক্লায়েন্ট-সাইড (Web) এবং অ্যান্ড্রয়েড নেটিভ ব্রিজের একটি পূর্ণাঙ্গ ব্লুপ্রিন্ট তৈরি করা হলো।

---

## ১. মাল্টি-TURN এবং STUN রিলে ক্লাস্টার (Optimized Free Relays with Auto-Fallback)

### সমস্যা:
একটি মাত্র ফ্রি ওপেন-রিলে (openrelay) ব্যবহার করলে পিক আওয়ারে প্যাকেট ড্রপ হয় বা আইস ক্যান্ডিডেট টাইমআউট হয়ে ১৫ সেকেন্ডের মাথায় কল কেটে যায়।

### সমাধান:
- Google STUN ক্লাস্টার (`stun.l.google.com:19302`, `stun1.l.google.com:19302`, `stun2.l.google.com:19302`)
- একাধিক ফ্রি টার্ন ও মেটার্ড সিকিউর ফলব্যাক রিলে
- `iceCandidatePoolSize: 10` এবং `bundlePolicy: 'max-bundle'` সক্রিয় করা যাতে কল পিক করার আগেই ক্যান্ডিডেট প্রস্তুত থাকে (Zero setup latency)।

---

## ২. স্টুডিও গ্রেড অডিও টিউনিং (Echo Cancellation & Noise Suppression)

### WebRTC অডিও কনস্ট্রেইন্ট টিউনিং:
- **Acoustic Echo Cancellation (AEC)**: স্পিকারের শব্দ মাইকে ফিরে আসা সম্পূর্ণ বন্ধ করা (`echoCancellation: true`, `googEchoCancellation: true`)।
- **Active Noise Suppression (ANS)**: পেছনের ফ্যান, বাতাসের শব্দ ফিল্টার করা (`noiseSuppression: true`, `googNoiseSuppression: true`)।
- **Automatic Gain Control (AGC)**: ব্যবহারকারী মুখ দূরে নিলেও ভলিউম স্বাভাবিক রাখা (`autoGainControl: true`, `googAutoGainControl: true`)।
- **Opus কোডেক অপ্টিমাইজেশন**:
  - `stereo=0` (মোবাইল কলের জন্য মনো অডিও ব্যান্ডউইথ বাঁচায়)
  - `maxaveragebitrate=32000` (ক্লিন ও কম্প্যাক্ট অডিও)
  - `useinbandfec=1` (প্যাকেট লস হলেও অডিও ড্রপ বা রোবোটিক সাউন্ড হয় না)

---

## ৩. ওয়াইফাই এবং মোবাইল ডাটা অটো-স্যুইচিং (Seamless Network Handover & ICE Restart)

### সমস্যা:
বাসা থেকে বের হওয়ার সময় ওয়াইফাই বন্ধ হয়ে মোবাইল ডাটাতে গেলে বা ৪জি/৫জি নেটওয়ার্ক ড্রপ করলে কল কেটে যায়।

### সমাধান:
- `window.addEventListener('online')` এবং `navigator.connection` পরিবর্তনের সাথে সাথে নীরব **ICE Restart** (`pc.restartIce()` বা `createOffer({ iceRestart: true })`)।
- UI তে সুন্দর "Reconnecting..." স্ট্যাটাস দেখানো এবং ৮-১০ সেকেন্ডের গ্রেস পিরিয়ড দেওয়া (কল না কেটে আগের অডিও বাফার ক্ল্যাস মুক্ত রাখা)।
- প্যাকেট রিসিভ বন্ধ হলে ইনস্ট্যান্ট পিং-পং প্রোব পাঠানো।

---

## ৪. প্রক্সিমেট্রি সেন্সর ও ইয়ারপিস/স্পিকার অটো-স্যুইচিং

### WhatsApp-এর মতো কানে নিলে স্ক্রিন অফ ও স্পিকারে কথা:
1. **Android Bridge Integration**:
   - `window.AndroidInterface.setAudioMode('earpiece')` এবং `window.AndroidInterface.setAudioMode('speaker')`।
   - নেটিভ প্রক্সিমেট্রি সেন্সর ইভেন্ট লিসেনার: কানে ফোন ঠেকলে স্ক্রিন অফ (`WAKE_LOCK_PROXIMITY_SCREEN_OFF`) এবং অডিও ইয়ারপিসে যাবে; কান থেকে সরালে স্পিকারে যাবে।
2. **Web Audio Route & UI Controls**:
   - কলে থাকা অবস্থায় ম্যানুয়াল স্পিকার/ইয়ারপিস টগল বাটন।
   - অডিও এলিমেন্টে `sinkId` হ্যান্ডলিং (সমর্থিত ব্রাউজারে)।

---

## ৫. হোয়াটসঅ্যাপের মতো নিখুঁত কল স্টেটাস ও ফিডব্যাক

### স্টেটস:
1. **Outgoing Flow**:
   - `Calling...` (সার্ভারে রিকোয়েস্ট গেছে)
   - `Ringing...` (রিসিভারের ফোনে রিংটোন বাজছে — রিসিভার থেকে `ringing_ack` পাওয়ার পর)
   - `Connecting...` (রিসিভার কল রিসিভ করেছে, WebRTC হ্যান্ডশেক চলছে)
   - `00:01, 00:02...` (কল কানেক্টেড এবং ২-ওয়ে অডিও সক্রিয়)
2. **Busy & Unavailable Flow**:
   - রিসিভার অন্য কলে থাকলে: `User is on another call` (Busy tone প্লে হবে এবং কল শেষ হবে)
   - রিসিভার ৩০ সেকেন্ডের মধ্যে না ধরলে: `No answer`
   - রিসিভার কল কাটলে: `Call Declined`
3. **Incoming Flow**:
   - ফুলস্ক্রিন ডায়ালগ, স্পিকার/মিউট বাটন এবং সোয়াইপ/ক্লিক টু অ্যানসার।

---

## ৬. অ্যান্ড্রয়েড নেটিভ CallStyle ও লক স্ক্রিন ওয়েকআপ (Native Architecture Integration)

### অ্যান্ড্রয়েড নেটিভ অংশে যা নিশ্চিত করতে হবে:
1. **FCM High-Priority Data Push**:
   - নোটিফিকেশন পেলোড নয়, ডেটা পেলোড পাঠাতে হবে (`priority: 'high'`)।
2. **Android Telecom Framework / CallStyle Notification**:
   - `NotificationCompat.CallStyle.forIncomingCall(...)` ব্যবহার করে ফুল-স্ক্রিন ইনকামিং কল অ্যাক্টিভিটি।
   - স্ক্রিন লক থাকলেও স্ক্রিন অন করে রিংটোন বাজানো (`FLAG_KEEP_SCREEN_ON`, `FLAG_SHOW_WHEN_LOCKED`, `FLAG_TURN_SCREEN_ON`)।
3. **Web Bridge Sync**:
   - নেটিভ থেকে "Answer" চাপলে `window.handleNativeCallAction('answer', callId)` নির্বিঘ্নে পেজ রিলোড ছাড়াই WebRTC হ্যান্ডশেক শেষ করে।

---

## বাস্তবায়নের ধাপসমূহ (Immediate Action Plan for Web):

1. **Phase 1: WebRTC Service আপগ্রেড (`callService.ts`)**:
   - মাল্টি-রিলে আইস সার্ভার ও ক্যান্ডিডেট পুল কনফিগারেশন।
   - অ্যাডভান্সড অডিও কনস্ট্রেইন্টস (AEC, ANS, AGC, Opus FEC)।
   - নেটওয়ার্ক স্যুইচিং অটো-আইস রিস্টার্ট লিসেনার।
2. **Phase 2: সুনির্দিষ্ট কল স্ট্যাটাস ও সাউন্ড ইফেক্ট**:
   - `ringing` একনলেজমেন্ট সিগন্যালিং যুক্ত করা (যাতে কলার বুঝতে পারে রিসিভারের ফোনে আসলেই রিং বাজছে)।
   - `busy` হ্যান্ডলিং (রিসিভার অলরেডি কোনো কলে থাকলে কলারকে Busy সিগন্যাল পাঠানো)।
3. **Phase 3: স্পিকার/ইয়ারপিস ব্রিজ ও প্রক্সিমেট্রি হ্যান্ডলার**:
   - AndroidInterface অডিও রাউটিং ব্রিজ তৈরি।
   - স্ক্রিন প্রক্সিমেট্রি ও স্পিকার স্টেট সিঙ্ক।
4. **Phase 4: ভেরিফিকেশন ও কমপাইল টেস্ট**:
   - কোড লিন্ট ও বিল্ড টেস্ট।
