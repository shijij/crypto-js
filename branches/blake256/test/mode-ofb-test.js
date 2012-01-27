YUI.add('mode-ofb-test', function (Y) {
    var C = CryptoJS;

    Y.Test.Runner.add(new Y.Test.Case({
        name: 'mode.OFB',

        testEncrypt: function () {
            var message = C.lib.WordArray.create([
                0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210,
                0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210
            ]);
            var key = C.lib.WordArray.create([0x00000000, 0x00000000, 0x00000000, 0x00000000]);
            var iv = C.lib.WordArray.create([0x45670123, 0xcdef89ab, 0x45670123, 0xcdef89ab]);

            var expected = message.clone();
            C.algo.AES._init(key);

            // First block XORed with encrypted IV
            var keystream = iv.words.slice(0);
            C.algo.AES._encryptBlock(keystream, 0);
            for (var i = 0; i < 4; i++) {
                expected.words[i] ^= keystream[i];
            }

            // Subsequent blocks XORed with encrypted previous keystream
            C.algo.AES._encryptBlock(keystream, 0);
            for (var i = 0; i < 4; i++) {
                expected.words[4 + i] ^= keystream[i];
            }

            var actual = C.algo.AES.encrypt(message, key, { iv: iv, padding: C.pad.NoPadding, mode: C.mode.OFB });

            Y.Assert.areEqual(expected.toString(), actual);
        },

        testDecrypt: function () {
            var message = C.lib.WordArray.create([
                0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210,
                0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210
            ]);
            var key = C.lib.WordArray.create([0x00000000, 0x00000000, 0x00000000, 0x00000000]);
            var iv = C.lib.WordArray.create([0x45670123, 0xcdef89ab, 0x45670123, 0xcdef89ab]);

            var encrypted = C.algo.AES.encrypt(message, key, { iv: iv, padding: C.pad.NoPadding, mode: C.mode.OFB });
            var decrypted = C.algo.AES.decrypt(encrypted, key, { iv: iv, padding: C.pad.NoPadding, mode: C.mode.OFB });

            Y.Assert.areEqual(message.toString(), decrypted);
        }
    }));
}, '$Rev$');
