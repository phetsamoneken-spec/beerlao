# ຕັ້ງຄ່າ Google Drive ສຳລັບ AGENT HQ

ໂຄດ OAuth ແລະການອ່ານໄຟລ໌ກຽມໄວ້ໃນ Draft PR ແລ້ວ. **ຍັງບໍ່ເຊື່ອມບັນຊີ Google ຈິງ ແລະຍັງບໍ່ deploy ສ່ວນ Drive.** ລິ້ງ `drive.google.com/drive/home` ເປັນໜ້າຫຼັກ; ບໍ່ແມ່ນ OAuth Client ຫຼືລິ້ງໄຟລ໌ທີ່ອະນຸຍາດໃຫ້ແອັບອ່ານ.

## 1. ສ້າງ Google Cloud project

1. ເປີດ https://console.cloud.google.com/ ດ້ວຍບັນຊີ Google ຂອງທ່ານ.
2. ກົດເລືອກ project ດ້ານເທິງ → **New Project**.
3. ໃສ່ຊື່ `AGENT HQ` → **Create** ແລ້ວເລືອກ project ນັ້ນ.
4. ເປີດ [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) → **Enable**.

## 2. ຕັ້ງໜ້າຂໍສິດ Google

ເປີດ **Google Auth Platform**. ບາງໜ້າອາດສະແດງຢູ່ **APIs & Services → OAuth consent screen**.

1. **Branding:** ຊື່ແອັບ `AGENT HQ`, support email ແລະ contact email ຂອງທ່ານ.
2. **Audience:** ຖ້າໃຊ້ Gmail ທົ່ວໄປ ເລືອກ **External**, ສະຖານະ **Testing** ແລະເພີ່ມອີເມວຕົນເອງໃນ **Test users**.
3. **Data Access:** ເພີ່ມສິດ `openid`, `email` ແລະ `https://www.googleapis.com/auth/drive.readonly`.
4. ບັນທຶກ. ສ່ວນ Drive ນີ້ຂໍອ່ານເທົ່ານັ້ນ; ບໍ່ຂໍສິດຂຽນ, ລຶບ ຫຼືແບ່ງປັນ.

`drive.readonly` ເປັນ restricted scope ຂອງ Google. ການເປີດໃຫ້ຜູ້ໃຊ້ພາຍນອກຫຼາຍຄົນ ອາດຕ້ອງຜ່ານ Google verification ແລະຂໍ້ກຳນົດການປະເມີນຄວາມປອດໄພ. ໃນໂໝດ Testing ທີ່ມີ Drive scope, refresh token ອາດໝົດອາຍຸຫຼັງ 7 ວັນ ແລະຕ້ອງເຊື່ອມໃໝ່. ເລີ່ມທົດສອບດ້ວຍບັນຊີ ແລະໄຟລ໌ທົດລອງກ່ອນ.

## 3. ສ້າງ OAuth Client

ເປີດ **Google Auth Platform → Clients → Create client** ຫຼື **APIs & Services → Credentials → Create credentials → OAuth client ID**.

- **Application type:** `Web application`
- **Name:** `AGENT HQ Drive`
- **Authorized redirect URIs:** ຄັດລອກຄ່າລຸ່ມນີ້ທັງໝົດ:

```text
https://vhywnalpkahkfqhiqdgd.supabase.co/functions/v1/drive-api/callback
```

ສ່ວນນີ້ໃຊ້ server authorization-code flow; ບໍ່ຈຳເປັນຕ້ອງໃສ່ JavaScript origin ສຳລັບ Google Picker. ຖ້າມີການໃຊ້ Google browser SDK ໃນອະນາຄົດ origin ຂອງເວັບແມ່ນ `https://phetsamoneken-spec.github.io`.

ກົດ **Create**. ເກັບ **Client ID** ແລະ **Client Secret** ໃນບ່ອນປອດໄພ. ບໍ່ສົ່ງ Client Secret ໃນແຊັດ ຫຼື commit ລົງ GitHub.

## 4. ຕັ້ງ Supabase Edge Secrets

ເປີດ project `Ai team` → **Edge Functions → Secrets** ແລ້ວເພີ່ມ:

| ຊື່ | ຄ່າ |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID ຈາກຂັ້ນຕອນ 3 |
| `GOOGLE_CLIENT_SECRET` | Client Secret ຈາກຂັ້ນຕອນ 3 |
| `GOOGLE_REDIRECT_URI` | callback URL ດ້ານເທິງ |
| `DRIVE_APP_URL` | `https://phetsamoneken-spec.github.io/beerlao/agent-hq/` |
| `ALLOWED_ORIGINS` | `https://phetsamoneken-spec.github.io` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | random key 32 bytes ແບບ Base64 |

ສາມາດສ້າງ encryption key ໃນ terminal ຂອງທ່ານດ້ວຍ `openssl rand -base64 32`, ແລ້ວນຳຜົນໄປໃສ່ Supabase Secrets ໂດຍກົງ. ຖ້າໃຫ້ Codex ຕັ້ງໃຫ້, ຈະຕ້ອງມີສິດ secrets write ກ່ອນ ແລະຈະບໍ່ສະແດງ key ໃນແຊັດ. ຢ່າປ່ຽນ key ທີ່ໃຊ້ແລ້ວໂດຍບໍ່ມີແຜນຍ້າຍ token; ລຸ້ນນີ້ຮອງຮັບ key version 1.

Supabase runtime credentials ມາຈາກ Edge runtime; ຢ່າໃສ່ service-role key ໃນ frontend ຫຼືຊື່ຕົວແປທີ່ຂຶ້ນຕົ້ນ `VITE_`.

## 5. ສິດທີ່ Codex ຍັງຂາດ

ຖ້າບໍ່ເຫັນ Codex Environment editor, ໃຫ້ໃຊ້ [ວິທີ PowerShell ໃນ Windows](windows-drive-deployment.lo.md). ວິທີນີ້ບໍ່ຕ້ອງສົ່ງ token ໃຫ້ Codex ຫຼື Publish environment.

Management token ປັດຈຸບັນຕອບ 403 ສຳລັບ Functions ແລະ Secrets. ຖ້າໃຫ້ Codex deploy ໃຫ້, ສ້າງ token ຈຳກັດສະເພາະ project ນີ້ ແລະໃຫ້ Read/Write ສຳລັບ **Edge Functions** ແລະ **Edge Function Secrets**. ການກວດ Auth URLs ຕ້ອງມີສິດ **Auth configuration** ດ້ວຍ.

ນຳ token ໃໝ່ໄປໃສ່ **Codex Environment → HTTP secrets → `SUPABASE_ACCESS_TOKEN`**, allowed domain `api.supabase.com`, ບັນທຶກ ແລະ Publish environment ຜ່ານ UI. ບໍ່ສົ່ງ token ໃນແຊັດ. ຖ້າຕັ້ງ Secrets ເອງໃນ Supabase UI ກໍບໍ່ຈຳເປັນໃຫ້ Codex ຮູ້ຄ່າ secret.

## 6. ຕິດຕັ້ງຫຼັງກວດທານ

ກ່ອນເປີດໃຊ້ຈິງ ຕ້ອງກວດ ແລະອະນຸມັດການປ່ຽນແປງໃໝ່ນີ້:

1. ລັນ migration `202611050003_google_drive.sql` ເທົ່ານັ້ນ ເທິງ schema ທີ່ຕິດຕັ້ງ Phase 2 ແລ້ວ. ຢ່າລັນ migrations 001/002 ຊ້ຳ.
2. Deploy `drive-api` ພ້ອມ `verify_jwt=false` ຕາມ config. Callback ຈາກ Google ບໍ່ມີ Supabase JWT; ທຸກ POST ຂອງແອັບຍັງກວດ bearer session ກັບ Supabase Auth ໃນ function.
3. ທົດສອບ OAuth ຈິງດ້ວຍ test account, ການໝົດອາຍຸ ແລະ disconnect ກ່ອນ.
4. Build frontend ດ້ວຍ `VITE_GOOGLE_DRIVE_ENABLED=true` ແລະເຜີຍແຜ່ສະເພາະ branch ທີ່ອະນຸມັດ. ຄ່າເລີ່ມຕົ້ນຍັງເປັນ `false`.

## 7. ວິທີໃຊ້ຫຼັງຕິດຕັ້ງ

1. ເຂົ້າ **Cloud workspace**, ເລືອກອົງກອນ ແລ້ວເປີດ **Google Drive**.
2. Admin ຫຼື Manager ຂອງພະແນກກົດຍິນຍອມສິດອ່ານ → ກຽມເຊື່ອມ → ໄປ Google ໃນແຖບໃໝ່.
3. ກັບມາແຖບເດີມ, ກົດກວດການເຊື່ອມ, ກວດອີເມວ Google ແລ້ວກົດຢືນຢັນ. ຢ່າ reload ໃນລະຫວ່າງເຊື່ອມ.
4. ເລືອກບັນຊີ, ພະນັກງານທີ່ມີສິດ **Read data** ໃນພະແນກດຽວກັນ, ແລ້ວວາງລິ້ງໄຟລ໌ຈິງ ເຊັ່ນ `https://drive.google.com/file/d/FILE_ID/view` ຫຼື Google Docs link.
5. ອະນຸຍາດໄຟລ໌ນັ້ນ ແລ້ວກົດອ່ານ. ຮອງຮັບ UTF-8 text, CSV ແລະ Google Docs ບໍ່ເກີນ 1 MiB. ຍັງບໍ່ອ່ານ Google Forms, Sheets, PDF, Word, folders ຫຼື shortcuts.
6. ກວດເນື້ອຫາກ່ອນນຳໄປໃຊ້ໃນວຽກ. ແອັບບໍ່ສົ່ງເນື້ອຫາໃຫ້ AI ອັດຕະໂນມັດ.
7. ກົດ **Disconnect** ເພື່ອຢຸດການອ່ານ ແລະລຶບ token ທີ່ເກັບໄວ້. ການຖອນສິດຢູ່ Google ອາດກະທົບການເຊື່ອມອື່ນຂອງບັນຊີດຽວກັນໃນ OAuth app ນີ້.

ລຸ້ນນີ້ບໍ່ມີ Google write endpoint. ການບັນທຶກລາຍງານກັບ Drive ຕ້ອງເຮັດລຸ້ນຕໍ່ໄປ ພ້ອມການອະນຸມັດໄຟລ໌ ແລະປາຍທາງທີ່ຊັດເຈນ.
