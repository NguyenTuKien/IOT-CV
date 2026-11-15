#!/usr/bin/env node
// Hook riêng của IOT-CV: nếu trong lượt có sửa file khớp `watch`, thì ở CUỐI
// lượt chạy `command` một lần (không chạy sau từng lần sửa).
//
// Mọi hành vi đọc từ .claude/iot-cv-hooks.json — muốn đổi thì sửa file đó,
// không cần đụng code. Tắt tạm: IOT_CV_SKIP_HOOKS=1.
//
//   node iot-cv-backend-pytest.cjs mark  -> PostToolUse Edit|Write|MultiEdit
//   node iot-cv-backend-pytest.cjs run   -> Stop
//
// Chỉ thấy sửa bằng Edit/Write/MultiEdit, không thấy sửa bằng Bash.
// Hook không bao giờ làm hỏng phiên: config lỗi hay thiếu thì im lặng bỏ qua.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONFIG_FILE = path.join(PROJECT_DIR, '.claude', 'iot-cv-hooks.json');
const MARKER = path.join(PROJECT_DIR, '.claude', 'session-state', 'iot-cv-backend-dirty');
const TAIL_LINES = 40;

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).backendTests;
    if (!c || c.enabled === false || c.onFail === 'off') return null;
    return c;
  } catch {
    return null;
  }
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// Glob tối giản: ** = mọi thư mục con, * = mọi ký tự trừ /.
function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = esc.replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '(?:.*/)?');
  return new RegExp(`^${re}$`);
}

function isWatched(filePath, watch) {
  if (!filePath) return false;
  const rel = path.relative(PROJECT_DIR, path.resolve(filePath)).replace(/\\/g, '/');
  return (watch || []).some(g => globToRegex(g).test(rel));
}

function mark(cfg, input) {
  const filePath = input.tool_input && input.tool_input.file_path;
  if (!isWatched(filePath, cfg.watch)) return;
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, new Date().toISOString());
}

function run(cfg, input) {
  if (!fs.existsSync(MARKER)) return;
  const res = spawnSync(cfg.command, {
    cwd: PROJECT_DIR,
    shell: true,
    encoding: 'utf8',
    timeout: (cfg.timeoutSec || 240) * 1000,
  });
  if (res.status === 0) {
    fs.rmSync(MARKER, { force: true });
    return;
  }
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim().split('\n');
  const detail = res.error ? `không chạy được: ${res.error.message}` : out.slice(-TAIL_LINES).join('\n');

  // notify, hoặc đã nhắc Claude một lần trong lượt này: chỉ báo người dùng.
  // Giữ marker để lượt sau kiểm lại.
  if (cfg.onFail === 'notify' || input.stop_hook_active) {
    process.stdout.write(JSON.stringify({
      systemMessage: `[iot-cv] \`${cfg.command}\` đang đỏ sau khi sửa file được theo dõi.`,
    }));
    return;
  }
  process.stderr.write(
    `[iot-cv] Lượt này có sửa file được theo dõi và \`${cfg.command}\` đang đỏ. ` +
      'Xem lỗi dưới đây; nếu đó là trạng thái có chủ đích (đang làm dở, test cũ cần đổi) ' +
      'thì cứ nói rõ với người dùng rồi dừng, không bắt buộc phải sửa ngay.\n' +
      `${detail}\n` +
      'Chỉnh hành vi hook: .claude/iot-cv-hooks.json\n',
  );
  process.exit(2);
}

if (process.env.IOT_CV_SKIP_HOOKS === '1') process.exit(0);
const cfg = loadConfig();
if (!cfg) process.exit(0);
const mode = process.argv[2];
const input = readStdin();
if (mode === 'mark') mark(cfg, input);
else if (mode === 'run') run(cfg, input);
