import sys

with open('src/pages/WalletSMS.tsx', 'r') as f:
    content = f.read()

target = """        const phones = targets.map(inst => inst.phone).filter(p => !!p);
        if (phones.length === 0) throw new Error('No institutions with valid phone numbers found.');"""

replacement = """        const phones = targets.map(inst => inst.phone).filter(p => !!p);
        if (phones.length === 0) throw new Error('No institutions with valid phone numbers found.');"""

# Actually, I don't need to patch WalletSMS if the user is only complaining about VoiceBroadcast.
# Wait, let's look at WalletSMS handleSendBulk
