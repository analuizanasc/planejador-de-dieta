'use strict';

// Encaminha rejeições de handlers async para o errorHandler central,
// evitando try/catch repetido em cada rota.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
