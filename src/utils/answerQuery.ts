export  function answerQuery(q: string, setAnswer, setSource , PROFILE: any) {
    const qn = q.trim().toLowerCase();
    if (!qn) { setAnswer('Ask me anything about my skills, projects, or experience.'); setSource(''); return; }

    // simple heuristics
    if (qn.includes('react') || qn.includes('frontend')) {
      setAnswer(PROFILE.summary + ' I focus on React, TypeScript and component-driven development.');
      setSource('Summary • Skills');
      return;
    }
    if (qn.includes('react native') || qn.includes('expo') || qn.includes('mobile')) {
      setAnswer('I build mobile apps with Expo + React Native, using Expo Router, secure storage for tokens, and Reanimated for animations.');
      setSource('Projects • Skills');
      return;
    }
    if (qn.includes('authentication') || qn.includes('token')) {
      setAnswer('I implement secure authentication patterns: refresh tokens, secure storage (SecureStore / Keychain), and server-side validation in .NET backends.');
      setSource('Projects • Experience');
      return;
    }
    if (qn.includes('nfc') || qn.includes('desfire')) {
      setAnswer('I prototyped NFC-based wallet systems using MIFARE DESFire EV1 with authentication and top-up logic.');
      setSource('Projects');
      return;
    }
     // fallback: search fields
    const joined = [PROFILE.summary, ...PROFILE.skills, ...PROFILE.projects.map(p => p.summary)].join('\n').toLowerCase();
    if (joined.includes(qn)) {
      setAnswer('Yes — that is part of my profile. See the Projects and Skills sections for more details.');
      setSource('Profile');
      return;
    }

    setAnswer('I could not find an exact answer in my profile. Try asking about: React, React Native, Authentication, NFC, Projects, or Skills.');
    setSource('');
  }