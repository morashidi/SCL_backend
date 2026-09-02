const normalizePhone = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = String(value).trim();

  if (trimmed === "") {
    return null;
  }

  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("20") && !digits.startsWith("200")) {
    digits = `0${digits.slice(2)}`;
  }

  return digits === "" ? trimmed : digits;
};

module.exports = { normalizePhone };
