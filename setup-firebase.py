#!/usr/bin/env python3
"""
Simple Firebase setup tool with visual feedback
"""
import subprocess
import sys
import os
from pathlib import Path

def print_header():
    print("\n" + "="*60)
    print("  🔐 Hotdeal Firebase 로그인 설정")
    print("="*60 + "\n")

def print_instructions():
    print("📍 Firebase Console에서 가져오기:")
    print("   1. https://console.firebase.google.com 방문")
    print("   2. 프로젝트 선택")
    print("   3. ⚙️ 설정 → General 탭")
    print("   4. Your apps → Web 앱 찾기")
    print("   5. 아래 4개 값을 복사\n")

def get_credentials():
    """Get Firebase credentials from user with visual feedback"""
    creds = {}
    
    fields = [
        ("API Key", "apiKey", "AIzaSyD_..."),
        ("Auth Domain", "authDomain", "my-project.firebaseapp.com"),
        ("Project ID", "projectId", "my-project-12345"),
        ("App ID", "appId", "1:123456789012:web:abcdef...")
    ]
    
    for i, (label, key, placeholder) in enumerate(fields, 1):
        print(f"[{i}/4] {label}")
        print(f"      ({placeholder})")
        value = input("      → ").strip()
        
        if not value:
            print("      ❌ 빈 값은 허용되지 않습니다.\n")
            return None
        
        creds[key] = value
        print(f"      ✓ 저장됨\n")
    
    return creds

def confirm_credentials(creds):
    """Show summary and ask for confirmation"""
    print("\n" + "="*60)
    print("확인 사항:")
    print("="*60)
    print(f"API Key:      {creds['apiKey'][:20]}...")
    print(f"Auth Domain:  {creds['authDomain']}")
    print(f"Project ID:   {creds['projectId']}")
    print(f"App ID:       {creds['appId'][:30]}...")
    print()
    
    while True:
        response = input("맞습니까? (y/n): ").strip().lower()
        if response in ['y', 'yes']:
            return True
        elif response in ['n', 'no']:
            return False
        print("y 또는 n을 입력하세요.\n")

def run_setup(creds):
    """Run the actual setup"""
    os.chdir('/Users/jay/PycharmProjects/vscode/hotdeal')
    
    print("\n" + "="*60)
    print("🚀 설정 시작 중...")
    print("="*60 + "\n")
    
    try:
        print("1️⃣  API Key 추가 중...")
        subprocess.run([
            'npx', 'vercel', 'env', 'add', 
            'NEXT_PUBLIC_FIREBASE_API_KEY', 'production',
            '--value', creds['apiKey'], '--yes', '--force'
        ], check=True, capture_output=False)
        print("   ✅ 완료\n")
        
        print("2️⃣  Auth Domain 추가 중...")
        subprocess.run([
            'npx', 'vercel', 'env', 'add',
            'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'production',
            '--value', creds['authDomain'], '--yes', '--force'
        ], check=True, capture_output=False)
        print("   ✅ 완료\n")
        
        print("3️⃣  Project ID 추가 중...")
        subprocess.run([
            'npx', 'vercel', 'env', 'add',
            'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'production',
            '--value', creds['projectId'], '--yes', '--force'
        ], check=True, capture_output=False)
        print("   ✅ 완료\n")
        
        print("4️⃣  App ID 추가 중...")
        subprocess.run([
            'npx', 'vercel', 'env', 'add',
            'NEXT_PUBLIC_FIREBASE_APP_ID', 'production',
            '--value', creds['appId'], '--yes', '--force'
        ], check=True, capture_output=False)
        print("   ✅ 완료\n")
        
        print("5️⃣  Vercel에 배포 중...")
        subprocess.run([
            'npx', 'vercel', '--prod', '--yes'
        ], check=True, capture_output=False)
        print("\n   ✅ 배포 완료\n")
        
        print("="*60)
        print("✅ 설정 성공!")
        print("="*60)
        print("\n2-3분 후 다음을 실행하세요:")
        print("   bash check-setup.sh\n")
        print("또는 방문하세요:")
        print("   https://jachwi-hotdeal.vercel.app\n")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ 오류 발생: {e}")
        if e.stderr:
            print(f"메시지: {e.stderr}")
        return False
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        return False

def main():
    print_header()
    print_instructions()
    
    creds = get_credentials()
    if not creds:
        print("❌ 설정 취소됨")
        sys.exit(1)
    
    if not confirm_credentials(creds):
        print("\n재시작합니다...\n")
        return main()
    
    success = run_setup(creds)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ 사용자가 취소함")
        sys.exit(1)
