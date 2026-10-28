/**
 * Supabase Question Bank Uploader Script
 * 
 * Usage:
 *   node scripts/upload_questions_to_supabase.js <path_to_json_or_directory>
 * 
 * Example:
 *   node scripts/upload_questions_to_supabase.js scripts/sample_book_questions.json
 * 
 * Required Environment Variables (.env or shell):
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (recommended) or VITE_SUPABASE_ANON_KEY
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
  console.log('Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const CHUNK_SIZE = 100; // Batch size for questions insertion

/**
 * Upload a single book JSON data object
 */
async function uploadBookData(data) {
  const { book, chapters, questions } = data;

  if (!book || !book.id || !book.title) {
    throw new Error('Invalid book metadata in JSON: missing "id" or "title"');
  }

  console.log(`\n📚 [1/3] Uploading Book: "${book.title}" (ID: ${book.id})...`);

  // 1. Upsert Book
  const bookPayload = {
    id: String(book.id),
    board: book.board || 'সাধারণ',
    class_name: book.class_name || 'অন্যান্য',
    title: book.title,
    subject_code: book.subject_code || '',
    cover_url: book.cover_url || '',
    pdf_url: book.pdf_url || '',
    source_type: book.source_type || 'easyqbd',
    total_chapters: chapters ? chapters.length : (book.total_chapters || 0),
    total_questions: questions ? questions.length : (book.total_questions || 0)
  };

  const { error: bookErr } = await supabase
    .from('qb_books')
    .upsert(bookPayload, { onConflict: 'id' });

  if (bookErr) {
    throw new Error(`Failed to insert book "${book.title}": ${bookErr.message}`);
  }
  console.log(`   ✔ Book record saved.`);

  // 2. Upsert Chapters
  if (chapters && chapters.length > 0) {
    console.log(`📑 [2/3] Uploading ${chapters.length} Chapters...`);
    const chaptersPayload = chapters.map((ch, idx) => ({
      id: String(ch.id || `ch-${book.id}-${idx + 1}`),
      book_id: String(book.id),
      chapter_no: ch.chapter_no || (idx + 1),
      title: ch.title || `অধ্যায় ${idx + 1}`
    }));

    const { error: chErr } = await supabase
      .from('qb_chapters')
      .upsert(chaptersPayload, { onConflict: 'id' });

    if (chErr) {
      console.warn(`   ⚠️ Warning inserting chapters: ${chErr.message}`);
    } else {
      console.log(`   ✔ ${chaptersPayload.length} chapters saved.`);
    }
  }

  // 3. Batch Insert Questions
  if (questions && questions.length > 0) {
    console.log(`❓ [3/3] Uploading ${questions.length} Questions (in batches of ${CHUNK_SIZE})...`);

    const defaultChapterId = (chapters && chapters[0]?.id) ? String(chapters[0].id) : `ch-${book.id}-1`;

    let totalUploaded = 0;
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE).map((q, idx) => ({
        id: String(q.id || `q-${book.id}-${i + idx + 1}`),
        book_id: String(book.id),
        chapter_id: String(q.chapter_id || defaultChapterId),
        category_type: q.category_type || 'সংক্ষিপ্ত প্রশ্ন',
        question_text: q.question_text || '',
        options: Array.isArray(q.options) ? q.options : null,
        answer_text: q.answer_text || null,
        default_marks: Number(q.default_marks) || 1,
        left_items: Array.isArray(q.left_items) ? q.left_items : null,
        right_items: Array.isArray(q.right_items) ? q.right_items : null
      }));

      const { error: qErr } = await supabase
        .from('qb_questions')
        .upsert(chunk, { onConflict: 'id' });

      if (qErr) {
        console.error(`   ❌ Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${qErr.message}`);
      } else {
        totalUploaded += chunk.length;
        process.stdout.write(`   ↳ Uploaded ${totalUploaded} / ${questions.length} questions...\r`);
      }
    }

    console.log(`\n   ✔ Finished uploading ${totalUploaded} questions for "${book.title}".`);
  }
}

/**
 * Main Runner
 */
async function run() {
  const targetPath = process.argv[2] || 'scripts/sample_book_questions.json';

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    console.log(`📁 Scanning directory: ${targetPath}`);
    const files = fs.readdirSync(targetPath);
    for (const f of files) {
      if (f.endsWith('.json')) {
        const fullPath = path.join(targetPath, f);
        console.log(`\n--------------------------------------------------`);
        console.log(`Processing file: ${fullPath}`);
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(raw);
          await uploadBookData(data);
        } catch (e) {
          console.error(`Error processing ${f}:`, e.message);
        }
      }
    }
  } else {
    console.log(`📄 Processing single file: ${targetPath}`);
    const raw = fs.readFileSync(targetPath, 'utf-8');
    const data = JSON.parse(raw);
    await uploadBookData(data);
  }

  console.log('\n🎉 অল ডান! সফলভাবে প্রশ্নগুলো Supabase-এ আপলোড সম্পন্ন হয়েছে।\n');
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
