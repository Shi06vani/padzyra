function send(res, data, status = 200) {
  res.status(status).json({ data });
}

function sendEmpty(res) {
  res.status(204).end();
}

module.exports = { send, sendEmpty };
