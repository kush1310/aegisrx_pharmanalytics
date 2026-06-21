import sys
import os
import json
import sqlite3
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

def run_analytics(db_path, upload_id):
    try:
        # Connect to the local SQLite database
        conn = sqlite3.connect(db_path)
        
        # Load tables into Pandas DataFrames
        # Filter by upload_id if provided
        if upload_id and upload_id.isdigit() and int(upload_id) > 0:
            query_sales = "SELECT * FROM SalesTransaction WHERE uploadId = ?"
            df_sales = pd.read_sql_query(query_sales, conn, params=(int(upload_id),))
        else:
            query_sales = "SELECT * FROM SalesTransaction"
            df_sales = pd.read_sql_query(query_sales, conn)
            
        df_pharmacy = pd.read_sql_query("SELECT id as pharmacyId, name as pharmacyName, doctorId FROM Pharmacy", conn)
        df_doctor = pd.read_sql_query("SELECT id as doctorId, name as doctorName FROM Doctor", conn)
        df_product = pd.read_sql_query("SELECT id as productId, name as productName FROM Product", conn)
        
        conn.close()
        
        # Gracefully handle empty datasets
        if df_sales.empty:
            print(json.dumps({
                "topPharmacies": [],
                "topDoctors": [],
                "topProducts": [],
                "doctorRatio": []
            }))
            return

        # Ensure correct datatypes
        df_sales['amount'] = pd.to_numeric(df_sales['amount'], errors='coerce').fillna(0.0)
        df_sales['saleQty'] = pd.to_numeric(df_sales['saleQty'], errors='coerce').fillna(0).astype(int)
        
        # ── 1. Top 10 Pharmacies by Revenue ──────────────────────────────────
        df_pharm_sales = df_sales.groupby('pharmacyId')['amount'].sum().reset_index()
        df_pharm_merged = df_pharm_sales.merge(df_pharmacy, on='pharmacyId', how='left')
        df_pharm_merged['pharmacyName'] = df_pharm_merged['pharmacyName'].fillna('Unknown Pharmacy')
        
        top_pharmacies = df_pharm_merged.sort_values(by='amount', ascending=False).head(10)
        top_pharmacies_list = top_pharmacies[['pharmacyName', 'amount']].rename(columns={'pharmacyName': 'name', 'amount': 'revenue'}).to_dict(orient='records')
        
        # ── 2. Top 10 Doctors by Revenue ─────────────────────────────────────
        # Join sales transactions with pharmacy to get doctorId, then with doctor to get name
        df_sales_with_pharm = df_sales.merge(df_pharmacy, on='pharmacyId', how='left')
        
        # Fill missing doctorId with -1 (Unlinked Pharmacies) to prevent pandas groupby from dropping them
        df_sales_with_pharm['doctorId'] = df_sales_with_pharm['doctorId'].fillna(-1)
        
        df_doc_sales = df_sales_with_pharm.groupby('doctorId')['amount'].sum().reset_index()
        df_doc_merged = df_doc_sales.merge(df_doctor, on='doctorId', how='left')
        
        # Format name for unlinked/unknown doctors
        df_doc_merged.loc[df_doc_merged['doctorId'] == -1, 'doctorName'] = 'Unlinked Pharmacies'
        df_doc_merged['doctorName'] = df_doc_merged['doctorName'].fillna('Unknown Doctor')
        
        top_doctors = df_doc_merged.sort_values(by='amount', ascending=False).head(10)
        top_doctors_list = top_doctors[['doctorName', 'amount']].rename(columns={'doctorName': 'name', 'amount': 'revenue'}).to_dict(orient='records')
        
        # ── 3. Top 10 Products by Revenue and Quantity ──────────────────────
        df_prod_sales = df_sales.groupby('productId').agg({'amount': 'sum', 'saleQty': 'sum'}).reset_index()
        df_prod_merged = df_prod_sales.merge(df_product, on='productId', how='left')
        df_prod_merged['productName'] = df_prod_merged['productName'].fillna('Unknown Product')
        
        top_products = df_prod_merged.sort_values(by='amount', ascending=False).head(10)
        top_products_list = top_products[['productName', 'amount', 'saleQty']].rename(columns={
            'productName': 'name', 
            'amount': 'revenue',
            'saleQty': 'quantity'
        }).to_dict(orient='records')
        
        # ── 4. Revenue per Doctor Ratio (Efficiency Metric) ──────────────────
        # Formula: Total Doctor Revenue / Number of Unique Linked Pharmacies
        df_pharmacy_with_doc = df_pharmacy.copy()
        df_pharmacy_with_doc['doctorId'] = df_pharmacy_with_doc['doctorId'].fillna(-1)
        df_pharm_count = df_pharmacy_with_doc.groupby('doctorId')['pharmacyId'].nunique().reset_index().rename(columns={'pharmacyId': 'pharmacyCount'})
        
        # Merge with doctor revenue
        df_ratio_merged = df_doc_sales.merge(df_pharm_count, on='doctorId', how='left')
        df_ratio_merged = df_ratio_merged.merge(df_doctor, on='doctorId', how='left')
        df_ratio_merged.loc[df_ratio_merged['doctorId'] == -1, 'doctorName'] = 'Unlinked Pharmacies'
        df_ratio_merged['doctorName'] = df_ratio_merged['doctorName'].fillna('Unknown Doctor')
        df_ratio_merged['pharmacyCount'] = df_ratio_merged['pharmacyCount'].fillna(1).astype(int)
        
        # Calculate ratio
        df_ratio_merged['ratio'] = df_ratio_merged['amount'] / df_ratio_merged['pharmacyCount']
        
        # Sort by ratio descending
        df_ratio_sorted = df_ratio_merged.sort_values(by='ratio', ascending=False)
        doctor_ratio_list = df_ratio_sorted[['doctorName', 'pharmacyCount', 'amount', 'ratio']].rename(columns={
            'doctorName': 'name',
            'amount': 'revenue',
            'pharmacyCount': 'pharmacies',
            'ratio': 'ratio'
        }).to_dict(orient='records')
        
        # Output as single compact JSON
        output = {
            "topPharmacies": top_pharmacies_list,
            "topDoctors": top_doctors_list,
            "topProducts": top_products_list,
            "doctorRatio": doctor_ratio_list
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        # Print fallback empty stats or JSON error
        print(json.dumps({
            "error": str(e),
            "topPharmacies": [],
            "topDoctors": [],
            "topProducts": [],
            "doctorRatio": []
        }))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing database path"}))
        sys.exit(1)
        
    db_path = sys.argv[1]
    upload_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    run_analytics(db_path, upload_id)
