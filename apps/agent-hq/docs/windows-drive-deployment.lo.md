# ສະຖານະ Drive deployment

ທ່ານ deploy `drive-api` version 1 ສຳເລັດແລ້ວຈາກ Windows ດ້ວຍສະຄຣິບ `ecf00378b093a7ecd956fb2cddfbf6b31349d638`. Token ຢູ່ໃນຄອມທ່ານ; Codex ບໍ່ໄດ້ຮັບຄ່າ token ຫຼືຄ່າ Google Secrets.

ຜົນຈາກ PowerShell: `functions : PASS`, `secrets : PASS`, `drive-api : DEPLOYED (version 1)`, `CORS : PASS`, `unauthenticated POST : DENIED`.

Codex ກວດ endpoint ຈິງອີກຄັ້ງ: allowed CORS 204, anonymous POST 401, callback ທີ່ບໍ່ມີ state 400 ແລະ origin ອື່ນ 403. Migration 003 ຕິດຕັ້ງແລ້ວ. ຢ່າລັນ SQL ຫຼືສະຄຣິບ deploy ຊ້ຳ.

HTTP 400 ກ່ອນໜ້ານີ້ເກີດຈາກ `nodeModulesDir: "manual"` ໃນ source-only upload. ແກ້ເປັນ `"auto"` ແລ້ວ; clean-directory check ແລະ upload ຈິງຜ່ານ. ສະຄຣິບລັອກ source `74766e9e8eb6af70dcc345032d9328244b9bc3a5`, ກວດ hashes, ປິດບັງ token ແລະບໍ່ທັບ function ທີ່ມີແລ້ວ. Offline PowerShell checks 8 ຂໍ້ຜ່ານ.

ຂັ້ນຕໍ່ໄປ: ເປີດ [ເວັບ AGENT HQ](https://phetsamoneken-spec.github.io/beerlao/agent-hq/) → Cloud workspace → ເຂົ້າລະບົບ/ເລືອກອົງກອນ → Google Drive. ເຮັດຕາມ [ຂັ້ນຕອນ 7 ໃນຄູ່ມື](google-drive-setup.lo.md#7-ວິທີໃຊ້ຫຼັງຕິດຕັ້ງ) ເພື່ອອະນຸຍາດ Google ແລະຢືນຢັນບັນຊີ. ການ deploy ຍັງບໍ່ໄດ້ເຊື່ອມບັນຊີ Google ໃຫ້ອັດຕະໂນມັດ.

[ຫຼັກຖານ release](verification/drive-release-2026-11-05.json) · [ຂໍ້ຈຳກັດ](google-drive-implementation.md)
