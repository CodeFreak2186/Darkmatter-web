
import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

class SupabaseTable:
    def __init__(self, client: 'SupabaseLite', table_name: str):
        self.client = client
        self.table_name = table_name
        self._data = None
        self._action = None
        self._column = None
        self._value = None

    def insert(self, data: dict):
        self._data = data
        self._action = "POST"
        return self

    def update(self, data: dict):
        self._data = data
        self._action = "PATCH"
        return self

    def eq(self, column: str, value: str):
        self._column = column
        self._value = value
        return self

    def execute(self):
        if not self._action:
            return None
            
        url = f"{self.client.url}/rest/v1/{self.table_name}"
        if self._column and self._value:
            url += f"?{self._column}=eq.{self._value}"
            
        try:
            with httpx.Client() as client:
                if self._action == "POST":
                    resp = client.post(url, json=self._data, headers=self.client.headers)
                elif self._action == "PATCH":
                    resp = client.patch(url, json=self._data, headers=self.client.headers)
                
                resp.raise_for_status()
                return resp
        except Exception as e:
            print(f"SupabaseLite Error: {e}")
            return None

class SupabaseLite:
    def __init__(self, url: str, key: str):
        self.url = url
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }

    def table(self, table_name: str):
        return SupabaseTable(self, table_name)

# Initialize the lite client
supabase = SupabaseLite(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def get_supabase():
    return supabase
