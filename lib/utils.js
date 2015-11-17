'use strict';

exports.makeContinuation = (predicate) => {

    return (callback) => {

        process.nextTick(() => {

            const result = predicate();
            callback(null, result);
        });
    };
};
