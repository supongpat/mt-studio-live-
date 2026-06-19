/**
 * cfMatcher.js
 * จับคำสั่ง CF + รหัสสินค้า (หลายรหัสได้) จากข้อความคอมเมนต์
 * รองรับ: "CF A01", "เอฟ a01", "cf A01 C01 Z02", "CF A01 2 ตัว B02"
 */
const CF_TRIGGER = /(?:cf|เอฟ|confirm)/i;
// จับรหัสสินค้า (ตัวอักษร 1-3 + เลข 1-4) พร้อมจำนวนที่ตามมา (ถ้ามี)
const CODE_PATTERN = /([a-zA-Z]{1,3}\d{1,4})(?:\s*(?:x|×|จำนวน)?\s*(\d{1,2})\s*(?:ตัว|ชิ้น|อัน)?)?/gi;

/**
 * จับรหัสเดียว (ของเดิม เผื่อโค้ดส่วนอื่นยังเรียกใช้)
 * @returns {{ code, quantity } | null}
 */
function matchCF(message) {
  const all = matchAllCF(message);
  return all.length ? all[0] : null;
}

/**
 * จับทุกรหัสในคอมเมนต์เดียว
 * @param {string} message
 * @returns {Array<{ code: string, quantity: number }>}
 */
function matchAllCF(message) {
  if (!message || !CF_TRIGGER.test(message)) return [];

  // ตัดเอาเฉพาะข้อความหลังคำว่า cf/เอฟ เพื่อไม่ให้จับรหัสมั่วจากข้อความอื่น
  const afterTrigger = message.slice(message.search(CF_TRIGGER));

  const results = [];
  const seen = new Set();
  let m;
  CODE_PATTERN.lastIndex = 0;
  while ((m = CODE_PATTERN.exec(afterTrigger)) !== null) {
    const code = m[1].toUpperCase();
    if (seen.has(code)) continue; // กันรหัสซ้ำในคอมเมนต์เดียว
    seen.add(code);
    results.push({ code, quantity: m[2] ? parseInt(m[2], 10) : 1 });
  }
  return results;
}

module.exports = { matchCF, matchAllCF };
