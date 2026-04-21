import requests

try:
    data = requests.get("http://localhost:8000/state").json()
    print("NODES:")
    for n in data['nodes']:
        print(f"  {n['id']} ({n['type']})")
    
    print("\nEDGES:")
    for e in data['edges']:
        print(f"  {e['source']} -> {e['target']} (ID: {e['id']})")

except Exception as e:
    print(e)
