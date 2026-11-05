# ຕິດຕັ້ງ Drive ໂດຍໃຊ້ PowerShell

ໃຊ້ວິທີນີ້ເມື່ອ Codex Environment editor ບໍ່ປາກົດ. Token ຈະຢູ່ໃນ PowerShell ຂອງທ່ານ; ບໍ່ຕ້ອງສົ່ງໃນແຊັດ ຫຼືໃສ່ໃນໂຄດ. ຮອງຮັບ PowerShell 7 ທີ່ທ່ານຕິດຕັ້ງແລ້ວ; ບໍ່ຕ້ອງມີ Node, Git ຫຼື Docker ໃນ Windows.

## ສະຖານະ

ຜົນ PowerShell ຂອງທ່ານແມ່ນ `functions : PASS` ແລະ `secrets : PASS`. ນີ້ຢືນຢັນສິດອ່ານຂອງ token ໃນຄອມທ່ານ; ຍັງບໍ່ແມ່ນການ deploy ຫຼື Google OAuth ສຳເລັດ. Codex ຍັງມີພຽງ token ຖານຂໍ້ມູນເດີມ. Token ໃໝ່ຕ້ອງມີ Edge Functions Read/Write ແລະ Edge Function Secrets Read.

## ສະຄຣິບທີ່ກຽມໄວ້

ໄຟລ໌ `scripts/windows-drive-deploy.ps1` ໃຊ້ [Supabase Management API](https://supabase.com/docs/reference/api/v1-deploy-a-function). ມັນອັບໂຫຼດສະເພາະ source ຂອງ `drive-api` ຈາກ commit `74766e9e8eb6af70dcc345032d9328244b9bc3a5`, ກວດ SHA-256 ຂອງທຸກໄຟລ໌ ແລະຈຳກັດ token ໃຫ້ສົ່ງໄປ `api.supabase.com` ໂດຍບໍ່ຕາມ redirect.

ດາວໂຫຼດໄຟລ໌ຈາກ Draft PR ເຂົ້າໃນໂຟນເດີທີ່ຫາງ່າຍ ແລ້ວກວດ source/hash ກ່ອນລັນ. ຂ້ອຍຈະໃຫ້ຄຳສັ່ງດາວໂຫຼດແບບລັອກ commit ແລະ hash ໃນແຊັດເມື່ອຮຸ່ນກວດທານພ້ອມ.

ໃນ PowerShell ທີ່ເປີດຢູ່ໂຟນເດີຂອງໄຟລ໌ນັ້ນ:

```powershell
& .\windows-drive-deploy.ps1
```

ຄ່າເລີ່ມຕົ້ນອ່ານກວດສິດ Functions/ຊື່ Secrets ເທົ່ານັ້ນ. ບໍ່ອ່ານຄ່າ Secrets, ບໍ່ deploy, ບໍ່ລັນ SQL ແລະບໍ່ສ້າງໄຟລ໌ທີ່ມີ token. ວາງ token ໃນຊ່ອງຮັບຄ່າທີ່ປິດບັງຫຼັງເລີ່ມສະຄຣິບ; ຢ່າພິມ token ເປັນຄຳສັ່ງ.

## ລຳດັບເປີດໃຊ້ຈິງ

**ອະນຸມັດ rollout ແລະຕິດຕັ້ງ migration 003 ແລ້ວ. ຢ່າລັນ SQL ຊ້ຳ.** ຂັ້ນຕໍ່ໄປແມ່ນ deploy backend ໃນ Windows ຕາມຂໍ້ 2; ຫຼັງ endpoint ຜ່ານ ຈຶ່ງເຜີຍແຜ່ frontend ຕາມຄຳອະນຸມັດເດີມ.

1. ກວດ ແລະອະນຸມັດ migration `202611050003_google_drive.sql` ສຳລັບ project `vhywnalpkahkfqhiqdgd`. Codex ສາມາດໃຊ້ສິດ Database ທີ່ມີເພື່ອຕິດຕັ້ງ ແລະກວດໃຫ້ໄດ້ຫຼັງອະນຸມັດ. ບໍ່ລັນ 001/002 ຊ້ຳ.
2. ຫຼັງ migration ສຳເລັດ ແລະອະນຸມັດ deploy backend ແລ້ວ ຈຶ່ງລັນ:

   ```powershell
   & .\windows-drive-deploy.ps1 -Deploy
   ```

   ສະຄຣິບຈະຂໍ token ແບບປິດບັງ, ກວດ Secrets ຄົບ 6 ຊື່ ແລະຂໍໃຫ້ພິມ `DEPLOY vhywnalpkahkfqhiqdgd` ກ່ອນສ້າງ function ຈິງ. ຖ້າມີ `drive-api` ຢູ່ແລ້ວ ມັນຈະຢຸດແລະບໍ່ຂຽນທັບ.
3. ສົ່ງກັບມາພຽງຜົນ `drive-api : DEPLOYED`, `CORS : PASS` ແລະ `unauthenticated POST : DENIED`. ຖ້າ upload ໝົດເວລາ/ບໍ່ແນ່ໃຈ ໃຫ້ກວດ Supabase Functions ກ່ອນລອງໃໝ່; ສະຄຣິບບໍ່ retry ອັດຕະໂນມັດ.
4. Codex ຈະກວດ endpoint ແລະເຜີຍແຜ່ frontend ທີ່ເປີດ Drive ຕາມຄຳອະນຸມັດ. Main ແລະ Draft PR ບໍ່ຖືກ merge.
5. ທ່ານເຂົ້າ Cloud workspace ດ້ວຍບັນຊີທີ່ຢືນຢັນອີເມວແລ້ວ, ສ້າງ/ເລືອກອົງກອນ ແລ້ວເຊື່ອມ Google Drive ແລະຢືນຢັນບັນຊີ Google ດ້ວຍຕົນເອງ.

ສະຄຣິບນີ້ສ້າງສະເພາະ backend function. ມັນບໍ່ປ່ຽນ Secrets, ບໍ່ລັນ SQL, ບໍ່ເປີດ frontend ແລະບໍ່ອ່ານ/ຂຽນໄຟລ໌ Google. ການທົດສອບ PowerShell ທີ່ກຽມໄວ້ໃຊ້ offline fixtures ເທົ່ານັ້ນ; ຍັງບໍ່ໄດ້ທົດສອບ upload ຈິງ.

## ການ upload ຄັ້ງທຳອິດຕອບ 400

ຜູ້ໃຊ້ລັນສະຄຣິບ e511721 ແລ້ວ API ຕອບ HTTP 400. ຂໍ້ຄວາມສາເຫດບໍ່ຖືກສະແດງໃນຮຸ່ນນັ້ນ; ຍັງບໍ່ຮູ້ສາເຫດແນ່ນອນ. Endpoint ຍັງຕອບ 404 ແລະ frontend ຍັງບໍ່ປ່ຽນ. ຮຸ່ນໃໝ່ໃຊ້ multipart ແບບ FormData (quoted names, metadata text field, ບໍ່ມີ filename* ຊ້ຳ, static_patterns ວ່າງ) ແລະລາຍງານ `API reason:` ຈາກຊ່ອງ error ທີ່ເລືອກໄວ້ ພ້ອມປິດບັງ token, ຈຳກັດຄວາມຍາວ ແລະຕັດ control characters. ນີ້ເປັນການປັບຄວາມເຂົ້າກັນໄດ້/ການວິນິດໄສ; ຍັງບໍ່ໄດ້ຢືນຢັນວ່າແກ້ການ upload ຈິງແລ້ວ. ຢ່າລັນ SQL ຊ້ຳ.

## ພົບສາເຫດ HTTP 400 ແລ້ວ

ຜົນຈາກ API reason ຢືນຢັນວ່າ `nodeModulesDir: "manual"` ຕ້ອງການ npm packages ທີ່ຕິດຕັ້ງໄວ້, ແຕ່ຊຸດ upload ມີພຽງ source files. ການປັບ multipart ກ່ອນໜ້ານີ້ບໍ່ໄດ້ຢືນຢັນວ່າເປັນສາເຫດ. ຮຸ່ນໃໝ່ປ່ຽນ config ເປັນ `"auto"` ແລະລັອກ source commit/hash ໃໝ່. ຈຳລອງ error ເດີມໄດ້ໃນ clean directory; ຫຼັງແກ້ ກວດທັງສອງ entry points ຜ່ານໂດຍບໍ່ມີ node_modules/cache ເກົ່າ. ຍັງຕ້ອງໃຫ້ຜູ້ໃຊ້ລັນ deploy ຮຸ່ນນີ້ຈາກ Windows ແລະກວດ endpoint ຈິງ. ບໍ່ຕ້ອງປ່ຽນ token ຫຼືລັນ SQL ຊ້ຳ.
