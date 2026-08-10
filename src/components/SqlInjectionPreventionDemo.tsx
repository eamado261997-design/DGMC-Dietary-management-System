import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Terminal, Lock, AlertTriangle, Code, Database, Sparkles, Bug } from "lucide-react";

interface SimulatedRecord {
  id: number;
  employee_no: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
}

const STATIC_SIMULATED_PEOPLE: SimulatedRecord[] = [
  { id: 1, employee_no: "MGR001", first_name: "Robert", last_name: "Downey", position: "ICT Director", department: "ICT Department" },
  { id: 2, employee_no: "EMP001", first_name: "Peter", last_name: "Parker", position: "Junior Developer", department: "ICT Department" },
  { id: 3, employee_no: "EMP002", first_name: "Wanda", last_name: "Maximoff", position: "Staff Nurse I", department: "Nursing Department" },
  { id: 4, employee_no: "EMP003", first_name: "Natasha", last_name: "Romanoff", position: "ER Specialist Nurse", department: "Emergency Room Services" }
];

export default function SqlInjectionPreventionDemo() {
  const [payloadInput, setPayloadInput] = useState<string>("' OR '1'='1");
  const [selectedExample, setSelectedExample] = useState<string>("OR_TRUE");

  const examples = [
    {
      id: "OR_TRUE",
      name: "Trivial bypass (' OR '1'='1)",
      payload: "' OR '1'='1",
      description: "Forces the WHERE clause to evaluate to TRUE for every single row in the database, revealing all accounts."
    },
    {
      id: "UNION_ATTACK",
      name: "UNION Schema Harvest",
      payload: "' UNION SELECT id, username, password FROM users --",
      description: "Attaches secondary tables to harvest column structures or sensitive password hashes."
    },
    {
      id: "STACKED_DROP",
      name: "Stacked Command (; DROP TABLE)",
      payload: "EMP001'; DROP TABLE people; --",
      description: "Attempts to terminate the active SELECT statement and execute a destructive command to delete tables."
    },
    {
      id: "CLEAN_QUERY",
      name: "Clean Employee Lookup (EMP001)",
      payload: "EMP001",
      description: "A legitimate, standard lookup parameter without malicious punctuation or quote characters."
    }
  ];

  const handleSelectExample = (id: string, payload: string) => {
    setSelectedExample(id);
    setPayloadInput(payload);
  };

  // 1. Simulate Vulnerable String Concatenation Behavior
  const getVulnerableQueryString = () => {
    return `SELECT * FROM people WHERE employee_no = '${payloadInput}';`;
  };

  const executeSimulatedVulnerableQuery = (): {
    parsedSQL: string;
    isInjected: boolean;
    results: SimulatedRecord[];
    explanation: string;
  } => {
    const rawSql = getVulnerableQueryString();
    
    // Simple heuristic simulation of a naive database parser treating the concatenated string as SQL logic
    const lowerInput = payloadInput.toLowerCase();
    
    // Check for drop table attempt
    if (lowerInput.includes("drop table") || lowerInput.includes(";")) {
      return {
        parsedSQL: rawSql,
        isInjected: true,
        results: [],
        explanation: "💥 CRITICAL: Stacked command execution detected! The semicolon (;) divided the query, causing the terminal statement to drop target files!"
      };
    }

    if (lowerInput.includes("or '1'='1") || lowerInput.includes("or 1=1") || lowerInput.includes("' or '") || lowerInput.includes("or ''='")) {
      return {
        parsedSQL: rawSql,
        isInjected: true,
        results: STATIC_SIMULATED_PEOPLE, // Return ALL employees
        explanation: "🚨 VULNERABILITY EXPLOITED: The condition '1'='1' evaluated to TRUE, neutralizing the employee_no filter. The attacker successfully harvested ALL personnel histories!"
      };
    }

    if (lowerInput.includes("union select") || lowerInput.includes("union")) {
      return {
        parsedSQL: rawSql,
        isInjected: true,
        results: STATIC_SIMULATED_PEOPLE,
        explanation: "🚨 INFORMATION EXPOSURE: The UNION statement forced the database to append secondary internal structures, displaying sensitive hashes to the attacker."
      };
    }

    // Match exact or fallback
    const matched = STATIC_SIMULATED_PEOPLE.filter(
      p => p.employee_no.toLowerCase() === payloadInput.toLowerCase()
    );

    return {
      parsedSQL: rawSql,
      isInjected: false,
      results: matched,
      explanation: matched.length > 0 
        ? "✅ Regular record matched successfully."
        : "ℹ️ Query compiled successfully but returned zero matches because the input matches no employee_no."
    };
  };

  // 2. Simulate Secure Parameterized Query (Prepared Statement)
  const getSecureQueryString = () => {
    return {
      queryPattern: "SELECT * FROM people WHERE employee_no = $1;",
      parameterBindValue: payloadInput
    };
  };

  const executeSimulatedSecureQuery = (): {
    parsedSQL: string;
    bindings: string[];
    results: SimulatedRecord[];
    explanation: string;
  } => {
    const pattern = getSecureQueryString();
    
    // In parameterized queries, the input is strictly validated as a literal sequence.
    // The database does NOT evaluate 'OR', ';', or 'UNION' inside $1 as SQL commands.
    // It will literally look for a person whose exact column value is the string input payload.
    const matched = STATIC_SIMULATED_PEOPLE.filter(
      p => p.employee_no === payloadInput
    );

    return {
      parsedSQL: pattern.queryPattern,
      bindings: [pattern.parameterBindValue],
      results: matched,
      explanation: "🛡️ COMPLIANT PROTECTION: The database pre-compiled the SELECT operation. The payload was treated strictly as a single literal search string parameter ($1). The database searched for an administrator or researcher whose exact ID text was literally the SQL injection payload string, yielding 0 search matches and zero unauthorized exposure."
    };
  };

  const vulnResult = executeSimulatedVulnerableQuery();
  const secureResult = executeSimulatedSecureQuery();

  return (
    <div id="sql-injection-playground" className="space-y-6">
      {/* Overview Intro Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-[#003299] text-white p-6 rounded-3xl border border-teal-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-40 h-40" />
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full w-fit border border-white/10 text-teal-300 text-[10px] font-mono tracking-wider uppercase font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Audit Training Interface</span>
        </div>
        <h3 className="text-xl font-extrabold tracking-tight">SQL Injection Defense &amp; Parameterization Mode</h3>
        <p className="text-zinc-300 text-xs mt-2 max-w-2xl leading-relaxed">
          When deploying this system locally in VS Code or to a network server, you must defend against malicious input. This security laboratory demonstrates how building raw string queries exposes sensitive hospital personnel, whereas using <strong>Parameterized Queries (Prepared Statements)</strong> completely neutralizes attackers.
        </p>
      </div>

      {/* Input Selection Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playloads Presets Panel */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4">
          <span className="text-xs font-bold text-zinc-800 block border-b border-zinc-100 pb-2">
            🔬 Attack Payload Library (Select to Simulation)
          </span>
          <div className="space-y-2.5">
            {examples.map((ex) => (
              <button
                key={ex.id}
                onClick={() => handleSelectExample(ex.id, ex.payload)}
                className={`w-full text-left p-3 rounded-2xl border transition-all text-xs block ${
                  selectedExample === ex.id
                    ? "bg-teal-50/70 border-teal-350 text-teal-900 font-medium"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{ex.name}</span>
                  {ex.id === "CLEAN_QUERY" ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Safe Match</span>
                  ) : (
                    <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">Exploit Payload</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 font-mono mt-1 select-none font-bold truncate">
                  {ex.payload}
                </p>
                <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-sans">
                  {ex.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Live Try Input */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-3xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-zinc-500" />
                <span>Active Search Parameter (Simulates Terminal Input)</span>
              </label>
              <span className="text-[10px] font-mono bg-zinc-100 px-2 py-0.5 rounded font-black text-zinc-500 uppercase">Input string variable</span>
            </div>
            
            <textarea
              className="w-full min-h-[90px] font-mono text-xs p-3.5 bg-zinc-50 border border-zinc-250 rounded-2xl outline-none focus:border-teal-600 focus:bg-white transition-all text-zinc-800 font-bold tracking-wide"
              value={payloadInput}
              onChange={(e) => {
                setPayloadInput(e.target.value);
                setSelectedExample("CUSTOM_PAYLOAD");
              }}
              placeholder="Inject custom payload here..."
            />
          </div>

          {/* Code Context Alert */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">JSON Database Immunity Note:</span>
              <p className="text-amber-800 text-[10px] leading-relaxed">
                Divine Grace Medical Center currently stores transient records inside a secured client-side local JSON engine using strict callback selectors. Because JavaScript arrays are not assessed by SQL engines, the site is immune to actual injection. Below is a high-fidelity rendering of how the identical variable is processed if connected to normal corporate relational database setups (PostgreSQL / SQLite).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparisons Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT: Vulnerable Assembly */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden">
          {vulnResult.isInjected && (
            <div className="absolute top-0 right-0 bg-rose-500 text-white font-mono text-[9px] tracking-widest uppercase font-bold px-3.5 py-1 rounded-bl-xl flex items-center gap-1">
              <Bug className="w-3 h-3 animate-bounce" />
              <span>Exploit Successful</span>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-150">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-850 block">String Concatenation Assembly</span>
                <span className="text-[10px] text-zinc-550 block">Using raw interpolation: <code>{"WHERE col = '${input}'"}</code></span>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-3.5 font-mono text-[10px] text-zinc-300 overflow-x-auto border border-zinc-800">
              <span className="text-zinc-500 font-bold text-[9px] block mb-1 uppercase tracking-wider">// Constructed SQL String Send to DB</span>
              <span className="text-rose-400 font-bold block whitespace-pre-wrap">{vulnResult.parsedSQL}</span>
            </div>

            <div className={`p-3 rounded-2xl border text-[11px] leading-relaxed font-bold ${
              vulnResult.isInjected 
                ? "bg-rose-50 text-rose-900 border-rose-200" 
                : "bg-zinc-50 text-zinc-600 border-zinc-200"
            }`}>
              {vulnResult.explanation}
            </div>
          </div>

          <div>
            <div className="border-t border-zinc-100 pt-3">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Simulated Output Rows ({vulnResult.results.length})</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                {vulnResult.results.length === 0 ? (
                  <div className="text-zinc-450 p-3 italic text-center border border-dashed rounded-xl">
                    No matching personnel retrieved (Database query returned emptyset)
                  </div>
                ) : (
                  vulnResult.results.map((r, idx) => (
                    <div key={idx} className="p-2 border border-zinc-150 rounded-xl bg-zinc-50 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-zinc-800 block">{r.first_name} {r.last_name}</span>
                        <span className="text-zinc-450 text-[9px]">{r.position} • {r.department}</span>
                      </div>
                      <span className="text-rose-600 font-bold font-mono text-[9px] uppercase bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">Exposed</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Parameterized Binding */}
        <div className="bg-white border border-zinc-200 rounded-3xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-600 text-white font-mono text-[9px] tracking-widest uppercase font-bold px-3.5 py-1 rounded-bl-xl flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Fully Neutralized</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-150">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-850 block">Parameterized Query Binding</span>
                <span className="text-[10px] text-zinc-550 block">Compiler treats variable separated from SQL structure</span>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-2xl p-3.5 font-mono text-[10px] text-zinc-300 overflow-x-auto border border-zinc-800 space-y-2">
              <div>
                <span className="text-zinc-500 font-bold text-[9px] block mb-1 uppercase tracking-wider">// 1. Statement Template</span>
                <span className="text-teal-400 font-bold block">{secureResult.parsedSQL}</span>
              </div>
              <div className="border-t border-zinc-800 pt-1.5">
                <span className="text-zinc-500 font-bold text-[9px] block mb-1 uppercase tracking-wider">// 2. Dynamic Input Bindings ($1 parameter list)</span>
                <span className="text-emerald-400 font-bold block truncate">
                  $1 = "{secureResult.bindings[0]}"
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl text-[11px] leading-relaxed font-bold">
              {secureResult.explanation}
            </div>
          </div>

          <div>
            <div className="border-t border-zinc-100 pt-3">
              <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block mb-1.5">Simulated Output Rows ({secureResult.results.length})</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[10px]">
                {secureResult.results.length === 0 ? (
                  <div className="text-emerald-800 p-3 italic text-center border border-emerald-150 rounded-xl bg-emerald-50/20 font-bold">
                    🛡️ No literal matches returned. System fully secure.
                  </div>
                ) : (
                  secureResult.results.map((r, idx) => (
                    <div key={idx} className="p-2 border border-emerald-150 rounded-xl bg-emerald-50/20 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-zinc-800 block">{r.first_name} {r.last_name}</span>
                        <span className="text-zinc-450 text-[9px]">{r.position} • {r.department}</span>
                      </div>
                      <span className="text-emerald-700 font-bold font-mono text-[9px] uppercase bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">Safe Retrieve</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Code Snippet Guides for Local Laptop Setup */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-5 space-y-4">
        <span className="text-xs font-bold text-zinc-850 flex items-center gap-1.5 uppercase tracking-widest font-mono">
          <Code className="w-4 h-4 text-teal-700" />
          <span>Production SQL Coding Patterns for VS Code</span>
        </span>
        
        <p className="text-[11px] text-zinc-550 leading-relaxed">
          When copying this backend to run on your laptop via local SQLite or remote Postgres, write queries following these secure templates instead of concatenating strings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Node PG postgres configuration */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold text-zinc-650 block">1. Node-Postgres (pg) library</span>
            <pre className="bg-zinc-950 font-mono text-[10px] text-zinc-300 p-4 rounded-2xl overflow-x-auto border border-zinc-900 leading-snug">
{`// ❌ VULNERABLE string interpolation
await client.query("SELECT * FROM users WHERE active = '" + req.body.val + "'");

// ✅ SECURE parameterized lookup
const queryText = "SELECT * FROM users WHERE active = $1";
const values = [req.body.val];
const res = await client.query(queryText, values);`}
            </pre>
          </div>

          {/* SQLite configuration */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold text-zinc-650 block">2. SQLite3 library (Standard Node)</span>
            <pre className="bg-zinc-950 font-mono text-[10px] text-zinc-300 p-4 rounded-2xl overflow-x-auto border border-zinc-900 leading-snug">
{`// ❌ VULNERABLE (invites ' OR '1'='1)
db.all(\`SELECT * FROM schedule WHERE date='\${input}'\`);

// ✅ SECURE (parameterized binds values)
db.all(
  "SELECT * FROM schedule WHERE date = ?",
  [input],
  (err, rows) => { /* ... */ }
);`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
