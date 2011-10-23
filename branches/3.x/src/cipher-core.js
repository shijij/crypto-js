CryptoJS.lib.Cipher || (function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var C_lib_Base = C_lib.Base;
    var C_lib_WordArray = C_lib.WordArray;
    var C_enc = C.enc;
    var C_enc_Utf8 = C_enc.Utf8;
    var C_enc_Base64 = C_enc.Base64;
    var C_algo = C.algo;
    var C_algo_EvpKDF = C_algo.EvpKDF;

    /**
     * Base cipher template.
     *
     * @property {number} _keySize This cipher's key size. Default: 4
     * @property {number} _ivSize This cipher's IV size. Default: 4
     */
    var C_lib_Cipher = C_lib.Cipher = C_lib_Base.extend({
        /**
         * Configuration options.
         *
         * @property {CryptoJS.lib.WordArray} iv The IV to use for this operation.
         */
        _cfg: C_lib_Base.extend(),

        /**
         * Encrypts the passed message using the key and configuration.
         *
         * @param {CryptoJS.lib.WordArray|UTF-8 string} message The message to encrypt.
         * @param {CryptoJS.lib.WordArray} key The key.
         * @param {object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CryptoJS.lib.WordArray} The ciphertext.
         *
         * @static
         */
        encrypt: function (message, key, cfg) {
            // Apply config defaults
            cfg = this._cfg.extend(cfg);

            // Convert string to WordArray, else assume WordArray already
            if (typeof message == 'string') {
                message = C_enc_Utf8.fromString(message);
            } else {
                message = message.clone();
            }

            // Perform cipher-specific logic
            this._doEncrypt(message, key, cfg);

            // Return the now-encrypted message
            return message;
        },

        /**
         * Decrypts the passed ciphertext using the key and configuration.
         *
         * @param {CryptoJS.lib.WordArray|CryptoJS.lib.WordArray.encoder-encoded string} ciphertext
         *   The ciphertext to decrypt.
         * @param {CryptoJS.lib.WordArray} key The key.
         * @param {object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CryptoJS.lib.WordArray} The plaintext.
         *
         * @static
         */
        decrypt: function (ciphertext, key, cfg) {
            // Apply config defaults
            cfg = this._cfg.extend(cfg);

            // Convert string to WordArray, else assume WordArray already
            if (typeof ciphertext == 'string') {
                ciphertext = C_lib_WordArray.encoder.fromString(ciphertext);
            } else {
                ciphertext = ciphertext.clone();
            }

            // Perform cipher-specific logic
            this._doDecrypt(ciphertext, key, cfg);

            // Return the now-decrypted ciphertext
            return ciphertext;
        },

        _keySize: 4,

        _ivSize: 4,
    });

    /**
     * Base stream cipher template.
     */
    var C_lib_Cipher_Stream = C_lib_Cipher.Stream = C_lib_Cipher.extend({
        _doDecrypt: function () {
            // Encryption and decryption are identical operations
            return this._doEncrypt.apply(this, arguments);
        }
    });

    /**
     * Padding namespace.
     */
    var C_pad = C.pad = {};

    /**
     * PKCS #5/7 padding strategy.
     */
    var C_pad_PKCS5 = C_pad.PKCS5 = {
        /**
         * Pads the passed data using the algorithm defined in PCKS #5/7.
         *
         * @param {CryptoJS.lib.WordArray} data The data to pad.
         * @param {number} blockSize The multiple that the data should be padded to.
         *
         * @static
         */
        pad: function (data, blockSize) {
            // Shortcut
            var blockSizeBytes = blockSize * 4;

            // Count padding bytes
            var nPaddingBytes = (blockSizeBytes - data.sigBytes % blockSizeBytes) || blockSizeBytes;

            // Create padding word
            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

            // Create padding
            var padding = C_lib_WordArray.create();
            var paddingWords = padding.words;
            for (var i = 0; i < nPaddingBytes; i += 4) {
                paddingWords.push(paddingWord);
            }
            padding.sigBytes = nPaddingBytes;

            // Add padding
            data.concat(padding);
        },

        /**
         * Unpads the passed data that had been padded using the algorithm defined in PKCS #5/7.
         *
         * @param {CryptoJS.lib.WordArray} data The data to unpad.
         *
         * @static
         */
        unpad: function (data) {
            // Get number of padding bytes from last byte
            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

            // Remove padding
            data.sigBytes -= nPaddingBytes;
        }
    };

    /**
     * Mode namespace.
     */
    var C_mode = C.mode = {};

    /**
     * CBC block cipher mode.
     */
    var C_mode_CBC = C_mode.CBC = (function () {
        var CBC = {
            /**
             * Encrypts the message using the cipher and IV.
             *
             * @param {CryptoJS.lib.WordArray} message The message to encrypt.
             * @param {CryptoJS.lib.Cipher} cipher The block cipher to use.
             * @param {CryptoJS.lib.WordArray} iv The IV.
             *
             * @static
             */
            encrypt: function (message, cipher, iv) {
                // Shortcuts
                var messageWords = message.words;
                var messageWordsLength = messageWords.length;
                var cipherBlockSize = cipher._blockSize;
                var ivWords = iv.words;

                // Encrypt each block
                for (var offset = 0; offset < messageWordsLength; offset += cipherBlockSize) {
                    xorBlock(messageWords, ivWords, offset, cipherBlockSize);
                    cipher._encryptBlock(messageWords, offset);
                }
            },

            /**
             * Decrypts the ciphertext using the cipher and IV.
             *
             * @param {CryptoJS.lib.WordArray} ciphertext The ciphertext to decrypt.
             * @param {CryptoJS.lib.Cipher} cipher The block cipher to use.
             * @param {CryptoJS.lib.WordArray} iv The IV.
             *
             * @static
             */
            decrypt: function (ciphertext, cipher, iv) {
                // Shortcuts
                var ciphertextWords = ciphertext.words;
                var cipherBlockSize = cipher._blockSize;
                var ivWords = iv.words;

                // Decrypt each block
                for (var offset = ciphertextWords.length - cipherBlockSize; offset >= 0; offset -= cipherBlockSize) {
                    cipher._decryptBlock(ciphertextWords, offset);
                    xorBlock(ciphertextWords, ivWords, offset, cipherBlockSize);
                }
            }
        };

        function xorBlock(dataWords, ivWords, offset, blockSize) {
            if (offset == 0) {
                // XOR first block with IV
                for (var i = 0; i < blockSize; i++) {
                    dataWords[i] ^= ivWords[i];
                }
            } else {
                // XOR this block with previous crypted block
                for (var i = 0; i < blockSize; i++) {
                    dataWords[offset + i] ^= dataWords[offset + i - blockSize];
                }
            }
        }

        return CBC;
    }());

    /**
     * Base block cipher template.
     *
     * @property {number} _blockSize The number of 32-bit words this cipher operates on. Default: 16
     */
    C_lib_Cipher_Block = C_lib_Cipher.Block = C_lib_Cipher.extend({
        /**
         * @property {CryptoJS.pad.*} padding The padding strategy to use. Default: CryptoJS.pad.PKCS5
         * @property {CryptoJS.mode.*} mode The block mode to use. Default: CryptoJS.mode.CBC
         */
        _cfg: C_lib_Cipher._cfg.extend({
            padding: C_pad_PKCS5,
            mode: C_mode_CBC
        }),

        _doEncrypt: function (message, key, cfg) {
            // Pad
            cfg.padding.pad(message, this._blockSize);

            // Encrypt
            this._init(key);
            cfg.mode.encrypt(message, this, cfg.iv);
        },

        _doDecrypt: function (ciphertext, key, cfg) {
            // Decrypt
            this._init(key);
            cfg.mode.decrypt(ciphertext, this, cfg.iv);

            // Unpad
            cfg.padding.unpad(ciphertext);
        },

        _init: function () {
        },

        _blockSize: 16
    });

    /**
     * Format namespace.
     */
    var C_format = C.format = {};

    /**
     * OpenSSL-compatible formatting strategy.
     */
    var C_format_OpenSSL = C_format.OpenSSL = {
        /**
         * Converts the passed cipher params object to an OpenSSL-compatible string.
         *
         * @param {CryptoJS.lib.CipherParams} params The cipher params object.
         *
         * @return {Base-64 string} The OpenSSL-compatible string.
         *
         * @static
         */
        toString: function (params) {
            // Shortcuts
            var rawCiphertext = params.rawCiphertext;
            var salt = params.salt;

            // Format
            if (salt) {
                var openSSLStr = C_lib_WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(rawCiphertext);
            } else {
                var openSSLStr = rawCiphertext;
            }

            return openSSLStr.toString(C_enc_Base64);
        },

        /**
         * Converts the passed OpenSSL-compatible string to a cipher params object.
         *
         * @param {Base-64 string} openSSLStr The OpenSSL-compatible string.
         *
         * @return {CryptoJS.lib.CipherParams} The cipher params object.
         *
         * @static
         */
        fromString: function (openSSLStr) {
            var rawCiphertext = C_enc_Base64.fromString(openSSLStr);

            // Shortcut
            var rawCiphertextWords = rawCiphertext.words;

            // Test for salt
            if (rawCiphertextWords[0] == 0x53616c74 && rawCiphertextWords[1] == 0x65645f5f) {
                // Extract salt
                var salt = rawCiphertext.$super.create(rawCiphertextWords.slice(2, 4));

                // Remove salt from raw data
                rawCiphertextWords.splice(0, 4);
                rawCiphertext.sigBytes -= 16;
            }

            return C_lib_CipherParams.create({ rawCiphertext: rawCiphertext, salt: salt });
        }
    };

    /**
     * Key derivation function namespace.
     */
    var C_kdf = C.kdf = {};

    /**
     * OpenSSL-compatible key derivation function.
     */
    var C_kdf_OpenSSL = C_kdf.OpenSSL = {
        /**
         * Derives a key and IV from the passed password.
         *
         * @param {CryptoJS.lib.Cipher} cipher The cipher to generate a key for.
         * @param {UTF-8 string} password The password to derive from.
         * @param {CryptoJS.lib.WordArray|UTF-8 string} salt
         *   (Optional) A salt to use. If omitted, a salt will be generated randomly.
         *
         * @return {CryptoJS.lib.CipherParams} A cipher params object with a key, IV, and salt.
         *
         * @static
         */
        execute: function (cipher, password, salt) {
            // Generate random salt
            if ( ! salt) {
                salt = C_lib_WordArray.random(8);
            }

            // Shortcuts
            var cipherKeySize = cipher._keySize;
            var cipherIvSize = cipher._ivSize;

            // Derive key and IV
            var key = C_algo_EvpKDF.compute(password, salt, { keySize: cipherKeySize + cipherIvSize });

            // Separate key and IV
            var iv = key.$super.create(key.words.slice(cipherKeySize));
            key.sigBytes = cipherKeySize * 4;

            return C_lib_CipherParams.create({ key: key, iv: iv, salt: salt });
        }
    };

    /**
     * A collection of cipher parameters.
     *
     * @property {CryptoJS.lib.WordArray} rawCiphertext The raw ciphertext.
     * @property {CryptoJS.lib.WordArray} key The key to this ciphertext.
     * @property {CryptoJS.lib.WordArray} iv The IV used in the ciphering operation.
     * @property {CryptoJS.lib.WordArray} salt The salt used with a key derivation function.
     * @property {CryptoJS.cipher.format.*} formatter
     *   The default formatting strategy to use to convert this cipher params object to a string.
     */
    var C_lib_CipherParams = C_lib.CipherParams = C_lib_Base.extend({
        /**
         * Initializes a newly created cipher params object.
         *
         * @param {Object} params Any cipher parameters such as key, IV, salt, or rawCiphertext.
         */
        init: function (params) {
            this.mixIn(params);
        },

        /**
         * Converts this cipher params object to a string.
         *
         * @param {CryptoJS.format.*} formatter (Optional) The formatting strategy to use.
         *
         * @return {string} The stringified cipher params.
         *
         * @throws Error If neither the formatter nor the default formatter is set.
         */
        toString: function (formatter) {
            return (formatter || this.formatter).toString(this);
        }
    });

    /**
     * Password-based encryption.
     */
    var C_algo_PBE = C_algo.PBE = {
        /**
         * Configuration options.
         *
         * @property {CryptoJS.format.*} format
         *   The formatting strategy to use when converting the cipher params to and from a string.
         *   Default: CryptoJS.format.OpenSSL
         * @property {CryptoJS.kdf.*} kdf
         *   The key derivation function to use to generate a key, IV and salt from a password.
         *   Default: CryptoJS.kdf.OpenSSL
         */
        _cfg: C_lib_Base.extend({
            format: C_format_OpenSSL,
            kdf: C_kdf_OpenSSL
        }),

        /**
         * Encrypts the passed message using the cipher, password, and configuration.
         *
         * @param {CryptoJS.lib.Cipher} cipher The cipher algorithm to use.
         * @param {CryptoJS.lib.WordArray|UTF-8 string} message The message to encrypt.
         * @param {CryptoJS.lib.WordArray|UTF-8 string} password The password passed to a key derivation function.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CryptoJS.lib.CipherParams} A cipher params object.
         *
         * @static
         */
        encrypt: function (cipher, message, password, cfg) {
            // Apply config defaults
            cfg = this._cfg.extend(cfg);

            // Derive key
            var params = cfg.kdf.execute(cipher, password);

            // Encrypt
            params.rawCiphertext = cipher.encrypt(message, params.key, { iv: params.iv });

            // Set default formatter
            params.formatter = cfg.format;

            return ciphertextParams;
        },

        /**
         * Decrypts the passed ciphertext using the cipher, password, and configuration.
         *
         * @param {CryptoJS.lib.CipherParams|formatted cipher params string} ciphertext The ciphertext to decrypt.
         * @param {CryptoJS.lib.WordArray|UTF-8 string} password The password passed to a key derivation function.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CryptoJS.lib.WordArray} The decrypted plaintext.
         *
         * @static
         */
        decrypt: function (cipher, ciphertext, password, cfg) {
            // Apply config defaults
            cfg = this._cfg.extend(cfg);

            // Convert string to cipher params object, else assume cipher params object already
            if (typeof ciphertext == 'string') {
                ciphertext = cfg.format.fromString(ciphertext);
            }

            // Derive key
            var params = cfg.kdf.execute(cipher, password, ciphertext.salt);

            // Decrypt
            var plaintext = cipher.decrypt(ciphertext.rawCiphertext, params.key, { iv: params.iv });

            return plaintext;
        }
    };
}());
