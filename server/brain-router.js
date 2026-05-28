// server/brain-router.js — Multi-brain routing with GPT-5.5 family

const BRAINS = {
  claude_sonnet: {
    id: 'claude_sonnet',
    label: 'GPT-5.5 Deep',
    provider: 'openai',
    model: 'gpt-5.5',
    icon: 'A',
    color: '#a78bfa',
    colorDim: 'rgba(167,139,250,0.12)',
  },
  claude_opus: {
    id: 'claude_opus',
    label: 'GPT-5.5 Max',
    provider: 'openai',
    model: 'gpt-5.5',
    icon: 'A',
    color: '#c4b5fd',
    colorDim: 'rgba(196,181,253,0.12)',
  },
  gpt55: {
    id: 'gpt55',
    label: 'GPT-5.5',
    provider: 'openai',
    model: 'gpt-5.5',
    icon: 'G',
    color: '#34d399',
    colorDim: 'rgba(52,211,153,0.12)',
  },
  gpt54: {
    id: 'gpt54',
    label: 'GPT-5.4',
    provider: 'openai',
    model: 'gpt-5.4',
    icon: 'G',
    color: '#6ee7b7',
    colorDim: 'rgba(110,231,183,0.12)',
  },
  gpt54_mini: {
    id: 'gpt54_mini',
    label: 'GPT-5.4 Mini',
    provider: 'openai',
    model: 'gpt-5.4-mini',
    icon: 'G',
    color: '#a7f3d0',
    colorDim: 'rgba(167,243,208,0.10)',
  }
};

const ROUTING_HINTS = {
  claude_sonnet: [
    'linux','bash','terminal','shell','chmod','ssh','iptables','firewall','systemd','cron',
    'cybersecurity','pentest','ctf','exploit','vulnerability','cve','nmap','wireshark',
    'metasploit','kali','nessus','burp','owasp','snort','zeek','splunk',
    'cisco','vlan','ospf','bgp','switch','router','packet','subnetting','nat','acl',
    'gdpr','compliance','risk assessment','data protection','dpia','iso 27001',
    'anki','flashcard','onenote','exam','study','memorize','notes','revision',
    'report','internship','project','milestone','deliverable','nearingslivsforlagd',
    'python','javascript','typescript','code','script','debug','function','class','api',
    'hardening','audit','log','siem','incident','forensic','threat','ioc',
    'sentinel','core','lab','topology','port','fa0','g0','s1','s2'
  ],
  claude_opus: [
    'deep dive','in depth','thorough','comprehensive','research paper','whitepaper',
    'architecture','system design','complex','advanced','analyse everything',
    'full analysis','dissertation','thesis','detailed breakdown','exhaustive'
  ],
  gpt55: [
    'creative','story','poem','write a','imagine','invent','fiction',
    'brainstorm','ideas for','what would happen if','hypothetical',
    'reasoning','math','calculate','prove','logic puzzle','hard problem',
    'latest','current news','recent','today','what happened',
    'compare','pros and cons','versus','which is better'
  ],
  gpt54: [
    'translate','in arabic','in swedish','في','help me write','draft',
    'summarise','summarize','explain briefly','overview','tell me about',
    'what is','how does','general question','help me understand'
  ],
  gpt54_mini: [
    'quick','fast','brief','short answer','tldr','just tell me',
    'one line','simple question','lookup','define','what does'
  ]
};

function routeBrain(userMessage, conversationHistory = []) {
  const text = userMessage.toLowerCase();
  const scores = { claude_sonnet: 0, claude_opus: 0, gpt55: 0, gpt54: 0, gpt54_mini: 0 };

  for (const [brain, keywords] of Object.entries(ROUTING_HINTS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores[brain] += kw.split(' ').length;
    }
  }

  // GPT-5.5 Deep is Sentinel's home
  scores['claude_sonnet'] += 3;

  // Long + complex → Opus
  if (userMessage.length > 400) scores['claude_opus'] += 2;

  // Very short → mini
  if (userMessage.length < 35) scores['gpt54_mini'] += 1;

  // Deep conversation → Opus
  if (conversationHistory.length > 16) scores['claude_opus'] += 1;

  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

  const LABELS = {
    claude_sonnet: 'Security/technical task → GPT-5.5 Deep',
    claude_opus:   'Deep/complex task → GPT-5.5 Max',
    gpt55:         'Creative/reasoning task → GPT-5.5',
    gpt54:         'General task → GPT-5.4',
    gpt54_mini:    'Quick lookup → GPT-5.4 Mini'
  };

  return { brain: BRAINS[winner], scores, reasoning: LABELS[winner] };
}

module.exports = { routeBrain, BRAINS };
