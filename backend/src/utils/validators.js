function required(value, field) {
  if (value === undefined || value === null || String(value).trim() === "") {
    const error = new Error(`${field} is required`);
    error.statusCode = 400;
    throw error;
  }
}

function positiveNumber(value, field) {
  if (value !== undefined && (Number.isNaN(Number(value)) || Number(value) < 0)) {
    const error = new Error(`${field} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
}

module.exports = { required, positiveNumber };
