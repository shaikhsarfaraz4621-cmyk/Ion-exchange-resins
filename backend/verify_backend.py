import requests
import json

try:
    resp = requests.get("http://localhost:8000/state")
    data = resp.json()
    
    print(f"Server Tick: {data.get('tick')}")
    print(f"Is Simulating: {data.get('isSimulating')}")
    print(f"Batch Stage: {data.get('batchStage')}")
    
    nodes = data.get('nodes', [])
    print("\nNode Status:")
    for n in nodes:
        d = n['data']
        print(f"- {n['id']} ({n['type']}): Status={d.get('status')}, Conv={d.get('conversion')}%, Temp={d.get('temp')}C, Bottleneck={d.get('isBottleneck')}")
        
    bottleneck_ids = data.get('bottleneckNodeIds', [])
    print(f"\nGlobal Bottleneck IDs: {bottleneck_ids}")

except Exception as e:
    print(f"Error: {e}")
