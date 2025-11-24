// InterviewSimulator.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';

type Question = { id: string; text: string; keywords: string[] };

const DEFAULT_QUESTIONS: Question[] = [
  { id: 'q1', text: 'Tell me about yourself and your recent projects.', keywords: ['React', 'Expo', 'TypeScript', 'delivery', 'Zajel'] },
  { id: 'q2', text: 'How do you handle authentication and tokens in your apps?', keywords: ['refresh', 'token', 'secure', 'storage', '.NET'] },
  { id: 'q3', text: 'Describe a difficult bug you fixed and how you solved it.', keywords: ['debug', 'logs', 'breakdown', 'steps', 'fix'] },
  { id: 'q4', text: 'How would you handle a difficult customer call in English?', keywords: ['empathy', 'listen', 'steps', 'solution', 'calm'] },
];

function normalizeText(s = '') { return s.toLowerCase().replace(/[^\w\s]/g, ''); }

function scoreAnswer(transcript: string, keywords: string[]) {
  const text = normalizeText(transcript);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const unique = new Set(words).size;

  // Keyword hits
  const hits = keywords.reduce((c, k) => c + (text.includes(k.toLowerCase()) ? 1 : 0), 0);
  const hitRatio = keywords.length ? hits / keywords.length : 0;

  // filler words heuristic
  const fillers = ['um', 'uh', 'like', 'you know', 'so', 'actually'];
  const fillerCount = fillers.reduce((c, f) => c + (text.includes(f) ? 1 : 0), 0);

  // Score composition (0-100)
  let score = 50;
  score += Math.min(20, (hitRatio * 20)); // keywords up to +20
  score += Math.min(15, (Math.min(wordCount, 200) / 200) * 15); // length up to +15
  score -= Math.min(15, fillerCount * 3); // penalize fillers up to -15
  // slight bonus for lexical variety
  score += Math.min(10, (unique / Math.max(1, wordCount)) * 10);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    wordCount,
    hits,
    fillerCount,
  };
}

export default function InterviewSimulator({ questions = DEFAULT_QUESTIONS }: { questions?: Question[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState<Array<any>>([]);
  const recogRef = useRef<any>(null);

  // Feature-detect SpeechRecognition
  useEffect(() => {
    const win: any = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recogRef.current = null;
      return;
    }
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      let finalTrans = '';
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        const res = ev.results[i];
        if (res.isFinal) finalTrans += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((prev) => (finalTrans ? prev + ' ' + finalTrans : prev));
    };
    r.onerror = (e: any) => {
      console.warn('SpeechRecognition error', e);
      setListening(false);
      try { r.stop(); } catch {}
    };
    recogRef.current = r;
    // cleanup
    return () => {
      try { r.onresult = null; r.onerror = null; r.stop(); } catch {}
    };
  }, []);

  function startListening() {
    const r = recogRef.current;
    if (!r) {
      alert('SpeechRecognition not supported in this browser. Please type your answer in the text box.');
      return;
    }
    setTranscript('');
    try { r.start(); setListening(true); } catch (e) { console.error(e); setListening(false); }
  }

  function stopListening() {
    try {
      recogRef.current?.stop();
    } catch {}
    setListening(false);
  }

  function submitAnswer() {
    const q = questions[currentIdx];
    const s = scoreAnswer(transcript, q.keywords);
    const entry = {
      question: q.text,
      transcript,
      score: s.score,
      meta: s,
      date: new Date().toISOString(),
    };
    setHistory((h) => [...h, entry]);
    setTranscript('');
    setListening(false);
    setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
  }

  function downloadReport() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Interview Simulator Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Candidate: Mohamed`, 14, 28);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 34);
    let y = 44;
    history.forEach((h, idx) => {
      doc.setFontSize(11);
      doc.text(`${idx + 1}. Q: ${h.question}`, 14, y);
      y += 6;
      doc.setFontSize(10);
      const txt = doc.splitTextToSize(`A: ${h.transcript}`, 180);
      doc.text(txt, 14, y);
      y += txt.length * 6;
      doc.text(`Score: ${h.score}  • Words: ${h.meta.wordCount}  • Keyword hits: ${h.meta.hits}`, 14, y);
      y += 10;
      if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.save('Interview_Report_Mohamed.pdf');
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' }} className="p-6 rounded-lg bg-white/95 shadow-md">
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Interactive Interview Simulator</h2>
      <p style={{ marginTop: 8, color: '#374151' }}>Record your answers, get instant transcription & scoring, and download a feedback report to attach to job applications.</p>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong>Question {currentIdx + 1} / {questions.length}:</strong>
          <div>{questions[currentIdx].text}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => listening ? stopListening() : startListening()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: listening ? '#ef4444' : '#10b981', color: '#fff', cursor: 'pointer' }}>
              {listening ? 'Stop Recording' : 'Start Recording'}
            </button>
            <button onClick={() => { stopListening(); submitAnswer(); }} style={{ marginLeft: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
              Submit Answer
            </button>
          </div>

          <textarea placeholder="Transcript will appear here (or type your answer)..." value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={() => { setTranscript(''); }} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}>Clear</button>
            <button onClick={() => { setTranscript(prev => prev + ' ' + 'I implemented authentication using refresh tokens and secure storage.'); }} style={{ padding: '6px 10px', borderRadius: 8 }}>Insert Example Phrase</button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <h4 style={{ marginBottom: 6 }}>Previous Answers</h4>
          {history.length === 0 && <div style={{ color: '#6b7280' }}>No answers yet — record and submit one.</div>}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600 }}>{i + 1}. Score: {h.score} / 100</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{h.question}</div>
                <div style={{ marginTop: 6 }}>{h.transcript}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>Words: {h.meta.wordCount} • Keyword hits: {h.meta.hits} • Fillers: {h.meta.fillerCount}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={downloadReport} style={{ padding: '8px 12px', borderRadius: 8, background: '#111827', color: '#fff' }} disabled={history.length === 0}>Download PDF Report</button>
          <button onClick={() => { setCurrentIdx(0); setHistory([]); setTranscript(''); }} style={{ padding: '8px 12px', borderRadius: 8 }}>Reset</button>
        </div>
      </div>
    </div>
  );
}
