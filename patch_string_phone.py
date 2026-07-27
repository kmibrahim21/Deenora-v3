import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    target = "const enPhone = bnToEn(phone);"
    replacement = "const enPhone = bnToEn(String(phone));"

    if target in content:
        content = content.replace(target, replacement)
        print(f"Patched {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)
    else:
        print(f"Target not found in {filepath}")

patch_file('src/pages/VoiceBroadcast.tsx')
patch_file('src/pages/WalletSMS.tsx')

