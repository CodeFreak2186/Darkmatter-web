"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Minus, Square, X as XIcon } from 'lucide-react';

// ─── Simulated File System ───────────────────────────────────
const FS: Record<string, string[]> = {
    '/': ['home', 'etc', 'var', 'usr', 'tmp', 'opt', 'root'],
    '/home': ['darkmatter'],
    '/home/darkmatter': ['scans', 'tools', 'reports', '.bashrc', 'config.yml'],
    '/home/darkmatter/scans': ['target_001.json', 'target_002.json', 'recon_data.xml'],
    '/home/darkmatter/tools': ['scanner.py', 'exploit_db.py', 'payload_gen.sh', 'README.md'],
    '/home/darkmatter/reports': ['report_2026-02-11.pdf', 'findings.csv', 'executive_summary.md'],
    '/etc': ['passwd', 'shadow', 'hosts', 'resolv.conf', 'darkmatter'],
    '/etc/darkmatter': ['scanner.conf', 'agents.yml', 'api_keys.enc'],
    '/root': ['.ssh', 'install.sh'],
    '/var': ['log', 'www'],
    '/var/log': ['darkmatter.log', 'auth.log', 'syslog'],
    '/usr': ['bin', 'local', 'share'],
    '/tmp': ['scan_tmp_001', '.cache'],
    '/opt': ['darkmatter-engine'],
};

const FILE_CONTENTS: Record<string, string> = {
    '/home/darkmatter/.bashrc': `# ~/.bashrc: executed by bash for non-login shells
export PATH="$PATH:/opt/darkmatter-engine/bin"
export DARKMATTER_API_KEY="dm_live_xxxxxxxxxxxx"
alias scan="python3 /home/darkmatter/tools/scanner.py"
alias cls="clear"
alias ll="ls -la"

# Custom prompt
PS1='\\[\\033[01;31m\\]┌──(\\[\\033[01;32m\\]darkmatter㉿kali\\[\\033[01;31m\\])─[\\[\\033[0;37m\\]\\w\\[\\033[01;31m\\]]\\n└─\\$ '
`,
    '/home/darkmatter/config.yml': `# Darkmatter Scanner Configuration
target: "https://api.targetapp.com"
profile: full
agents:
  - discovery
  - fuzzing
  - auth
  - config
  - code
timeout: 300
threads: 10
rate_limit: 100
proxy: null
`,
    '/etc/hosts': `127.0.0.1\tlocalhost
127.0.1.1\tkali.darkmatter.local\tkali
192.168.1.100\ttarget.internal
10.10.14.2\thackthebox.eu

# Darkmatter infrastructure
10.0.0.1\tapi.darkmatter.internal
10.0.0.2\tdb.darkmatter.internal
10.0.0.3\tredis.darkmatter.internal
`,
};

// ─── History & Command Processing ────────────────────────────
interface TermLine {
    text: string;
    type: 'input' | 'output' | 'error' | 'success' | 'info' | 'banner';
}

const BANNER: TermLine[] = [
    { text: '', type: 'banner' },
    { text: '  ██████╗  █████╗ ██████╗ ██╗  ██╗███╗   ███╗ █████╗ ████████╗████████╗███████╗██████╗ ', type: 'banner' },
    { text: '  ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝████╗ ████║██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗', type: 'banner' },
    { text: '  ██║  ██║███████║██████╔╝█████╔╝ ██╔████╔██║███████║   ██║      ██║   █████╗  ██████╔╝', type: 'banner' },
    { text: '  ██║  ██║██╔══██║██╔══██╗██╔═██╗ ██║╚██╔╝██║██╔══██║   ██║      ██║   ██╔══╝  ██╔══██╗', type: 'banner' },
    { text: '  ██████╔╝██║  ██║██║  ██║██║  ██╗██║ ╚═╝ ██║██║  ██║   ██║      ██║   ███████╗██║  ██║', type: 'banner' },
    { text: '  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝', type: 'banner' },
    { text: '', type: 'banner' },
    { text: '  Darkmatter Security Terminal v2.4.0 — Kali Linux 2026.1', type: 'info' },
    { text: '  Type "help" for available commands.', type: 'info' },
    { text: '', type: 'output' },
];

export default function KaliTerminal({ onBack }: { onBack?: () => void } = {}) {
    const router = useRouter();
    const handleBack = onBack || (() => router.push('/'));
    const [lines, setLines] = useState<TermLine[]>([...BANNER]);
    const [input, setInput] = useState('');
    const [cwd, setCwd] = useState('/home/darkmatter');
    const [history, setHistory] = useState<string[]>([]);
    const [histIdx, setHistIdx] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }, [lines]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const addLines = useCallback((newLines: TermLine[]) => {
        setLines(prev => [...prev, ...newLines]);
    }, []);

    const processCommand = (cmd: string) => {
        const trimmed = cmd.trim();
        if (!trimmed) {
            addLines([{ text: '', type: 'output' }]);
            return;
        }

        setHistory(prev => [...prev, trimmed]);
        setHistIdx(-1);

        const parts = trimmed.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        const output: TermLine[] = [];

        switch (command) {
            case 'help':
                output.push(
                    { text: '', type: 'output' },
                    { text: '  AVAILABLE COMMANDS:', type: 'info' },
                    { text: '  ─────────────────────────────────────────────', type: 'output' },
                    { text: '  help              Show this help message', type: 'output' },
                    { text: '  clear / cls       Clear the terminal', type: 'output' },
                    { text: '  ls [dir]          List directory contents', type: 'output' },
                    { text: '  cd <dir>          Change directory', type: 'output' },
                    { text: '  cat <file>        Display file contents', type: 'output' },
                    { text: '  pwd               Print working directory', type: 'output' },
                    { text: '  whoami            Display current user', type: 'output' },
                    { text: '  id                Display user identity', type: 'output' },
                    { text: '  uname -a          System information', type: 'output' },
                    { text: '  ifconfig          Network interfaces', type: 'output' },
                    { text: '  nmap <target>     Port scan target', type: 'output' },
                    { text: '  scan <target>     Run Darkmatter scan', type: 'output' },
                    { text: '  sqlmap <url>      SQL injection test', type: 'output' },
                    { text: '  hydra <target>    Brute force attack', type: 'output' },
                    { text: '  hashcat <hash>    Hash cracking', type: 'output' },
                    { text: '  msfconsole        Metasploit framework', type: 'output' },
                    { text: '  netstat           Network statistics', type: 'output' },
                    { text: '  ping <host>       Ping a host', type: 'output' },
                    { text: '  curl <url>        HTTP request', type: 'output' },
                    { text: '  echo <text>       Print text', type: 'output' },
                    { text: '  date              Display current date', type: 'output' },
                    { text: '  uptime            System uptime', type: 'output' },
                    { text: '  exit              Close terminal', type: 'output' },
                    { text: '', type: 'output' },
                );
                break;

            case 'clear': case 'cls':
                setLines([]);
                return;

            case 'ls': {
                const target = args[0] ? (args[0].startsWith('/') ? args[0] : `${cwd} /${args[0]}`.replace(/\/+/g, '/')) : cwd;
                const contents = FS[target];
                if (contents) {
                    const formatted = contents.map(item => {
                        const fullPath = `${target}/${item}`.replace(/\/+/g, '/');
                        const isDir = FS[fullPath] !== undefined;
                        return isDir ? `\x1b[34m${item}/\x1b[0m` : item;
                    });
                    output.push({ text: formatted.join('  '), type: 'output' });
                } else {
                    output.push({ text: `ls: cannot access '${target}': No such file or directory`, type: 'error' });
                }
                break;
            }

            case 'cd': {
                if (!args[0] || args[0] === '~') { setCwd('/home/darkmatter'); break; }
                if (args[0] === '..') {
                    const parent = cwd.split('/').slice(0, -1).join('/') || '/';
                    setCwd(parent); break;
                }
                const target = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
                if (FS[target]) { setCwd(target); }
                else { output.push({ text: `bash: cd: ${args[0]}: No such file or directory`, type: 'error' }); }
                break;
            }

            case 'cat': {
                if (!args[0]) { output.push({ text: 'cat: missing operand', type: 'error' }); break; }
                const filePath = args[0].startsWith('/') ? args[0] : `${cwd}/${args[0]}`.replace(/\/+/g, '/');
                if (FILE_CONTENTS[filePath]) {
                    FILE_CONTENTS[filePath].split('\n').forEach(line => {
                        output.push({ text: line, type: 'output' });
                    });
                } else {
                    output.push({ text: `cat: ${args[0]}: No such file or directory`, type: 'error' });
                }
                break;
            }

            case 'pwd':
                output.push({ text: cwd, type: 'output' });
                break;

            case 'whoami':
                output.push({ text: 'darkmatter', type: 'output' });
                break;

            case 'id':
                output.push({ text: 'uid=1000(darkmatter) gid=1000(darkmatter) groups=1000(darkmatter),27(sudo),100(users)', type: 'output' });
                break;

            case 'uname':
                output.push({ text: 'Linux kali 6.6.9-amd64 #1 SMP PREEMPT_DYNAMIC Kali 6.6.9-1kali1 x86_64 GNU/Linux', type: 'output' });
                break;

            case 'hostname':
                output.push({ text: 'kali.darkmatter.local', type: 'output' });
                break;

            case 'date':
                output.push({ text: new Date().toString(), type: 'output' });
                break;

            case 'uptime':
                output.push({ text: ' 01:48:00 up 47 days, 12:32, 2 users, load average: 0.42, 0.38, 0.31', type: 'output' });
                break;

            case 'echo':
                output.push({ text: args.join(' '), type: 'output' });
                break;

            case 'ifconfig':
                output.push(
                    { text: 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500', type: 'output' },
                    { text: '        inet 10.10.14.7  netmask 255.255.254.0  broadcast 10.10.15.255', type: 'output' },
                    { text: '        inet6 fe80::a00:27ff:fe8e:7a3c  prefixlen 64  scopeid 0x20<link>', type: 'output' },
                    { text: '        ether 08:00:27:8e:7a:3c  txqueuelen 1000  (Ethernet)', type: 'output' },
                    { text: '        RX packets 284723  bytes 198234567 (189.0 MiB)', type: 'output' },
                    { text: '        TX packets 193847  bytes 24567890 (23.4 MiB)', type: 'output' },
                    { text: '', type: 'output' },
                    { text: 'tun0: flags=4305<UP,POINTOPOINT,RUNNING,NOARP,MULTICAST>  mtu 1500', type: 'output' },
                    { text: '        inet 10.10.14.2  netmask 255.255.254.0  destination 10.10.14.2', type: 'output' },
                    { text: '        UP POINTOPOINT RUNNING NOARP MULTICAST  MTU:1500  Metric:1', type: 'output' },
                );
                break;

            case 'netstat':
                output.push(
                    { text: 'Active Internet connections (servers and established)', type: 'output' },
                    { text: 'Proto  Local Address          Foreign Address        State', type: 'output' },
                    { text: 'tcp    0.0.0.0:22             0.0.0.0:*              LISTEN', type: 'output' },
                    { text: 'tcp    0.0.0.0:443            0.0.0.0:*              LISTEN', type: 'output' },
                    { text: 'tcp    10.10.14.7:48372       10.10.10.40:80         ESTABLISHED', type: 'output' },
                    { text: 'tcp    10.10.14.7:51923       10.10.10.40:443        ESTABLISHED', type: 'output' },
                    { text: 'udp    0.0.0.0:68             0.0.0.0:*', type: 'output' },
                );
                break;

            case 'ping':
                if (!args[0]) { output.push({ text: 'ping: usage error: Destination address required', type: 'error' }); break; }
                output.push(
                    { text: `PING ${args[0]} (10.10.10.40) 56(84) bytes of data.`, type: 'output' },
                    { text: `64 bytes from ${args[0]} (10.10.10.40): icmp_seq=1 ttl=63 time=32.4 ms`, type: 'output' },
                    { text: `64 bytes from ${args[0]} (10.10.10.40): icmp_seq=2 ttl=63 time=31.8 ms`, type: 'output' },
                    { text: `64 bytes from ${args[0]} (10.10.10.40): icmp_seq=3 ttl=63 time=33.1 ms`, type: 'output' },
                    { text: `--- ${args[0]} ping statistics ---`, type: 'output' },
                    { text: '3 packets transmitted, 3 received, 0% packet loss, time 2003ms', type: 'success' },
                );
                break;

            case 'nmap': {
                const target = args[args.length - 1] || '10.10.10.40';
                output.push(
                    { text: `Starting Nmap 7.94SVN ( https://nmap.org ) at ${new Date().toISOString()}`, type: 'info' },
                    { text: `Nmap scan report for ${target}`, type: 'output' },
                    { text: 'Host is up (0.032s latency).', type: 'output' },
                    { text: 'Not shown: 993 closed tcp ports', type: 'output' },
                    { text: 'PORT     STATE SERVICE       VERSION', type: 'output' },
                    { text: '22/tcp   open  ssh           OpenSSH 8.9p1', type: 'success' },
                    { text: '80/tcp   open  http          Apache 2.4.54', type: 'success' },
                    { text: '443/tcp  open  https         nginx 1.24.0', type: 'success' },
                    { text: '3306/tcp open  mysql         MySQL 8.0.32', type: 'error' },
                    { text: '5432/tcp open  postgresql    PostgreSQL 15.2', type: 'error' },
                    { text: '8080/tcp open  http-proxy    Squid 5.7', type: 'success' },
                    { text: '8443/tcp open  https-alt     Jetty 11.0.14', type: 'success' },
                    { text: '', type: 'output' },
                    { text: `Nmap done: 1 IP address (1 host up) scanned in 12.47 seconds`, type: 'info' },
                );
                break;
            }

            case 'scan': {
                const target = args[0] || 'https://api.targetapp.com';
                output.push(
                    { text: '', type: 'output' },
                    { text: `[*] Darkmatter Scanner v2.4 initialized`, type: 'info' },
                    { text: `[*] Target: ${target}`, type: 'info' },
                    { text: `[*] Profile: full | Agents: 5 | Threads: 10`, type: 'info' },
                    { text: '', type: 'output' },
                    { text: '[▸] Running discovery agent...', type: 'output' },
                    { text: '[▸] Running fuzzing agent...', type: 'output' },
                    { text: '[▸] Running auth agent...', type: 'output' },
                    { text: '[▸] Running config agent...', type: 'output' },
                    { text: '[▸] Running code agent...', type: 'output' },
                    { text: '', type: 'output' },
                    { text: '[✓] Discovery — 47 endpoints found', type: 'success' },
                    { text: '[✓] Fuzzing — 12 input vectors tested', type: 'success' },
                    { text: '[✓] Auth — 3 privilege escalation paths found', type: 'success' },
                    { text: '[!] CRITICAL: IDOR vulnerability on /api/v2/users/{id}', type: 'error' },
                    { text: '[!] HIGH: SQL injection in /api/search?q=', type: 'error' },
                    { text: '[!] HIGH: Missing rate limiting on /api/auth/login', type: 'error' },
                    { text: '[!] HIGH: JWT secret weakness detected', type: 'error' },
                    { text: '[✓] Config — 7 misconfigurations detected', type: 'success' },
                    { text: '[✓] Code — 4 hardcoded secrets found', type: 'success' },
                    { text: '', type: 'output' },
                    { text: '═══════════════════════════════════════════════════', type: 'output' },
                    { text: '  SCAN RESULTS', type: 'info' },
                    { text: '═══════════════════════════════════════════════════', type: 'output' },
                    { text: '  Critical:  1  │  High:  3  │  Medium:  7  │  Low:  12', type: 'output' },
                    { text: '  Total findings: 23  │  Scan time: 4.82s', type: 'output' },
                    { text: '═══════════════════════════════════════════════════', type: 'output' },
                    { text: '  [+] Report saved to /home/darkmatter/reports/', type: 'success' },
                    { text: '', type: 'output' },
                );
                break;
            }

            case 'sqlmap': {
                const url = args[0] || 'http://target.com/page?id=1';
                output.push(
                    { text: `[*] starting @ ${new Date().toTimeString().slice(0, 8)}`, type: 'info' },
                    { text: `[*] testing connection to the target URL: ${url}`, type: 'info' },
                    { text: '[*] checking if the target is protected by WAF/IPS', type: 'output' },
                    { text: '[+] target is not protected by any WAF/IPS', type: 'success' },
                    { text: "[*] testing 'AND boolean-based blind'", type: 'output' },
                    { text: "[+] parameter 'id' appears to be 'AND boolean-based blind' injectable", type: 'success' },
                    { text: "[*] testing 'MySQL >= 5.0 AND error-based'", type: 'output' },
                    { text: "[+] parameter 'id' is 'MySQL >= 5.0 AND error-based' injectable", type: 'success' },
                    { text: '', type: 'output' },
                    { text: 'sqlmap identified the following injection point(s):', type: 'info' },
                    { text: '  Parameter: id (GET)', type: 'output' },
                    { text: '    Type: boolean-based blind', type: 'output' },
                    { text: '    Type: error-based', type: 'output' },
                    { text: '    Type: time-based blind', type: 'output' },
                    { text: '', type: 'output' },
                    { text: '[+] back-end DBMS: MySQL >= 5.0', type: 'success' },
                );
                break;
            }

            case 'hydra': {
                const target = args[0] || '10.10.10.40';
                output.push(
                    { text: `Hydra v9.5 (c) 2023 by van Hauser/THC`, type: 'info' },
                    { text: `[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries`, type: 'output' },
                    { text: `[DATA] attacking ssh://${target}:22/`, type: 'output' },
                    { text: `[22][ssh] host: ${target}   login: admin   password: admin123`, type: 'success' },
                    { text: `[22][ssh] host: ${target}   login: root    password: toor`, type: 'success' },
                    { text: `[STATUS] 148237/14344399 checked, 2 valid`, type: 'info' },
                );
                break;
            }

            case 'hashcat': {
                output.push(
                    { text: 'hashcat (v6.2.6) starting...', type: 'info' },
                    { text: '', type: 'output' },
                    { text: 'OpenCL API (OpenCL 3.0) - Platform #1 [NVIDIA]', type: 'output' },
                    { text: '* Device #1: NVIDIA GeForce RTX 4090, 24564/24576 MB, 128MCU', type: 'output' },
                    { text: '', type: 'output' },
                    { text: `${args[0] || '5f4dcc3b5aa765d61d8327deb882cf99'}:password123`, type: 'success' },
                    { text: '', type: 'output' },
                    { text: 'Session..........: hashcat', type: 'output' },
                    { text: 'Status...........: Cracked', type: 'success' },
                    { text: 'Hash.Mode........: 0 (MD5)', type: 'output' },
                    { text: 'Speed.#1.........:  62347.8 MH/s', type: 'output' },
                    { text: 'Time.Estimated...: 0 secs', type: 'output' },
                );
                break;
            }

            case 'msfconsole':
                output.push(
                    { text: '', type: 'output' },
                    { text: '       =[ metasploit v6.3.55-dev ]', type: 'info' },
                    { text: '+ -- --=[ 2397 exploits - 1235 auxiliary - 422 post ]', type: 'output' },
                    { text: '+ -- --=[ 1391 payloads - 46 encoders - 11 nops ]', type: 'output' },
                    { text: '+ -- --=[ 9 evasion ]', type: 'output' },
                    { text: '', type: 'output' },
                    { text: 'Metasploit tip: Use sessions -1 to interact with the last opened session', type: 'info' },
                    { text: '', type: 'output' },
                    { text: '[!] Simulated Metasploit console. Type "exit" to return.', type: 'error' },
                    { text: '', type: 'output' },
                );
                break;

            case 'curl': {
                const url = args[0] || 'http://localhost';
                output.push(
                    { text: `  % Total    % Received   Time    Time     Time  Current`, type: 'output' },
                    { text: `                          Total   Spent    Left  Speed`, type: 'output' },
                    { text: `100  1256  100  1256    0     0   4521      0 --:--:-- --:--:-- --:--:-- 4523`, type: 'output' },
                    { text: `<!DOCTYPE html><html><head><title>${url}</title></head>`, type: 'output' },
                    { text: `<body><h1>200 OK</h1></body></html>`, type: 'output' },
                );
                break;
            }

            case 'exit':
                handleBack();
                return;

            default:
                output.push({ text: `bash: ${command}: command not found`, type: 'error' });
        }

        addLines(output);
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            addLines([{ text: `${input}`, type: 'input' }]);
            processCommand(input);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIdx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
                setHistIdx(newIdx);
                setInput(history[newIdx]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx >= 0) {
                const newIdx = histIdx + 1;
                if (newIdx >= history.length) { setHistIdx(-1); setInput(''); }
                else { setHistIdx(newIdx); setInput(history[newIdx]); }
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // Simple tab completion
            const partial = input.split(/\s+/).pop() || '';
            if (partial) {
                const contents = FS[cwd] || [];
                const match = contents.find(c => c.startsWith(partial));
                if (match) {
                    const parts = input.split(/\s+/);
                    parts[parts.length - 1] = match;
                    setInput(parts.join(' '));
                }
            }
        } else if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            setLines([]);
        }
    };

    const renderLine = (line: TermLine, idx: number) => {
        if (line.type === 'input') {
            return (
                <div key={idx} className="flex flex-wrap">
                    <span className="text-[#ff3333]">┌──(</span>
                    <span className="text-[#4af626] font-bold">darkmatter㉿kali</span>
                    <span className="text-[#ff3333]">)─[</span>
                    <span className="text-white font-bold">{cwd}</span>
                    <span className="text-[#ff3333]">]</span>
                    <br />
                    <span className="text-[#ff3333]">└─</span>
                    <span className="text-[#4af626]">$ </span>
                    <span className="text-white">{line.text}</span>
                </div>
            );
        }

        let textColor = 'text-[#d4d4d4]';
        if (line.type === 'error') textColor = 'text-[#ff6b6b]';
        if (line.type === 'success') textColor = 'text-[#4af626]';
        if (line.type === 'info') textColor = 'text-[#5cb3ff]';
        if (line.type === 'banner') textColor = 'text-[#4af626]';

        // Parse ANSI-like codes
        let text = line.text;
        text = text
            .replace(/\x1b\[32m/g, '</span><span class="text-[#4af626]">')
            .replace(/\x1b\[34m/g, '</span><span class="text-[#5cb3ff] font-bold">')
            .replace(/\x1b\[37m/g, '</span><span class="text-white font-bold">')
            .replace(/\x1b\[0m/g, '</span><span>');

        return (
            <div key={idx} className={`${textColor} leading-[1.4]`} dangerouslySetInnerHTML={{ __html: text }} />
        );
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col" style={{ fontFamily: "'IBM Plex Mono', 'Cascadia Code', 'Fira Code', monospace" }}>
            {/* Title bar */}
            <div className="h-8 bg-[#1a1a2e] flex items-center px-3 select-none shrink-0 border-b border-[#333]">
                <button onClick={handleBack} className="flex items-center gap-2 text-[12px] text-[#888] hover:text-[#4af626] transition-colors mr-4">
                    <ArrowLeft size={13} /> Exit Terminal
                </button>
                <div className="flex-1 text-center text-[12px] text-[#666]">
                    darkmatter@kali: {cwd}
                </div>
                <div className="flex items-center gap-3">
                    <Minus size={13} className="text-[#666] hover:text-white cursor-pointer" />
                    <Square size={11} className="text-[#666] hover:text-white cursor-pointer" />
                    <XIcon size={13} className="text-[#666] hover:text-[#ff5f57] cursor-pointer" onClick={handleBack} />
                </div>
            </div>

            {/* Terminal tabs */}
            <div className="h-7 bg-[#1a1a2e] flex items-center px-2 border-b border-[#333] text-[11px] shrink-0">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0c0c0c] text-[#4af626] rounded-t-sm border-t-2 border-t-[#4af626]">
                    bash — darkmatter@kali
                </div>
                <div className="px-3 py-1 text-[#666] hover:text-white cursor-pointer ml-1">
                    + New Tab
                </div>
            </div>

            {/* Terminal body */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-3 text-[13px] cursor-text"
                onClick={() => inputRef.current?.focus()}
            >
                {lines.map((line, i) => renderLine(line, i))}

                {/* Current prompt */}
                <div className="flex flex-wrap items-start mt-0.5">
                    <div>
                        <span className="text-[#ff3333]">┌──(</span>
                        <span className="text-[#4af626] font-bold">darkmatter㉿kali</span>
                        <span className="text-[#ff3333]">)─[</span>
                        <span className="text-white font-bold">{cwd}</span>
                        <span className="text-[#ff3333]">]</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className="text-[#ff3333]">└─</span>
                    <span className="text-[#4af626]">$ </span>
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        className="flex-1 bg-transparent text-white outline-none caret-[#4af626] text-[13px] ml-1"
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>
            </div>

            {/* Status bar */}
            <div className="h-5 bg-[#1a1a2e] flex items-center px-3 text-[10px] text-[#666] select-none shrink-0 border-t border-[#333]">
                <span>bash 5.2.21</span>
                <span className="mx-3">|</span>
                <span>{cwd}</span>
                <span className="mx-3">|</span>
                <span className="text-[#4af626]">●</span>
                <span className="ml-1">connected</span>
                <div className="flex-1" />
                <span>UTF-8</span>
                <span className="mx-3">|</span>
                <span>Kali Linux 2026.1</span>
            </div>
        </div>
    );
}
