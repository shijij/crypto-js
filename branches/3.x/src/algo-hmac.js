(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var C_lib_Base = C_lib.Base;
    var C_enc = C.enc;
    var C_enc_Utf8 = C_enc.Utf8;
    var C_algo = C.algo;

    var C_algo_HMAC = C_algo.HMAC = C_lib_Base.extend({
        /**
         * Initializes a newly created HMAC.
         *
         * @param {CryptoJS.lib.Hash} hasher The hash algorithm to use.
         * @param {CryptoJS.lib.WordArray|UTF-8 string} key The secret key.
         */
        init: function (hasher, key) {
            // Init hasher
            hasher = this._hasher = hasher.create();

            // Convert string to WordArray, else assume WordArray already
            if (typeof key == 'string') {
                key = C_enc_Utf8.fromString(key);
            }

            // Shortcuts
            var hasherBlockSize = hasher.blockSize;
            var hasherBlockSizeBytes = hasherBlockSize * 4;

            // Allow arbitrary length keys
            if (key.sigBytes > hasherBlockSizeBytes) {
                key = hasher.compute(key);
            }

            // Clone key for inner and outer pads
            var oKey = this._oKey = key.clone();
            var iKey = this._iKey = key.clone();

            // Shortcuts
            var oKeyWords = oKey.words;
            var iKeyWords = iKey.words;

            // XOR keys with pad constants
            for (var i = 0; i < hasherBlockSize; i++) {
                oKeyWords[i] ^= 0x5c5c5c5c;
                iKeyWords[i] ^= 0x36363636;
            }
            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

            // Set initial values
            this.reset();
        },

        /**
         * Resets this HMAC to its initial state.
         */
        reset: function () {
            // Shortcut
            var hasher = this._hasher;

            hasher.reset();
            hasher.update(this._iKey);
        },

        /**
         * Updates this HMAC using the passed message.
         *
         * @param {CryptoJS.lib.WordArray|UTF-8 string} messageUpdate The message to append.
         *
         * @return {CryptoJS.HMAC} This HMAC instance.
         */
        update: function (messageUpdate) {
            this._hasher.update(messageUpdate);

            // Chainable
            return this;
        },

        /**
         * Completes the HMAC computation, then resets this HMAC to its initial state.
         *
         * @param {CryptoJS.lib.WordArray|UTF-8 string} messageUpdate (Optional) A final message update.
         *
         * @return {CryptoJS.lib.WordArray} The HMAC.
         */
        compute: function (messageUpdate) {
            // Final message update
            if (messageUpdate) {
                this.update(messageUpdate);
            }

            // Shortcut
            var hasher = this._hasher;

            // Compute HMAC
            var hmac = hasher.compute(this._oKey.clone().concat(hasher.compute()));

            this.reset();

            return hmac;
        }
    });

    /**
     * HMAC_MD5 helper.
     */
    C.HMAC_MD5 = function (message, key) {
        return C_algo_HMAC.create(C_algo.MD5, key).compute(message);
    };

    /**
     * HMAC_SHA1 helper.
     */
    C.HMAC_SHA1 = function (message, key) {
        return C_algo_HMAC.create(C_algo.SHA1, key).compute(message);
    };

    /**
     * HMAC_SHA256 helper.
     */
    C.HMAC_SHA256 = function (message, key) {
        return C_algo_HMAC.create(C_algo.SHA256, key).compute(message);
    };
}());
