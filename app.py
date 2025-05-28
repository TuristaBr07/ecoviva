import io
import datetime
import numpy as np
import matplotlib
matplotlib.use('Agg')  # backend headless
import matplotlib.pyplot as plt

from flask import Flask, render_template, jsonify, request, redirect, url_for
import requests
from flask_caching import Cache
from flask_sqlalchemy import SQLAlchemy
from typing import Optional, Tuple, Dict, Any
from decimal import Decimal

app = Flask(__name__)
cache = Cache(app, config={'CACHE_TYPE': 'simple'})

# --- Configuração do Banco de Dados ---
app.config['SQLALCHEMY_DATABASE_URI'] = (
    'mysql+pymysql://root:Fe47223552%40@127.0.0.1:3306/ecoviva_db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- MODELS ---
class Community(db.Model):
    __tablename__ = 'communities'
    id           = db.Column(db.String(36), primary_key=True)
    nome         = db.Column(db.String(255), nullable=False)
    lat          = db.Column(db.Numeric(9,6), nullable=False)
    lon          = db.Column(db.Numeric(9,6), nullable=False)
    meta_doacao  = db.Column(db.Numeric(12,2), nullable=False, default=30000.00)
    doacao_atual = db.Column(db.Numeric(12,2), nullable=False, default=0.00)
    donations    = db.relationship('Donation', backref='community', lazy=True,
                                   cascade='all, delete-orphan')
    irradiances  = db.relationship('IrradianceData', backref='community', lazy=True,
                                   cascade='all, delete-orphan')
class Donation(db.Model):
    __tablename__ = 'donations'
    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    community_id  = db.Column(db.String(36),
                               db.ForeignKey('communities.id', ondelete='CASCADE'),
                               nullable=False)
    amount        = db.Column(db.Numeric(12,2), nullable=False)
    donation_date = db.Column(db.DateTime, nullable=False,
                              default=datetime.datetime.utcnow)
    
class IrradianceData(db.Model):
    __tablename__    = 'irradiance_data'
    id               = db.Column(db.Integer, primary_key=True, autoincrement=True)
    community_id     = db.Column(db.String(36),
                                 db.ForeignKey('communities.id', ondelete='CASCADE'),
                                 nullable=False)
    measurement_date = db.Column(db.Date, nullable=False)
    irradiance       = db.Column(db.Float)
    __table_args__   = (db.UniqueConstraint('community_id','measurement_date'),)

# --- Modelo de usuário 
class User(db.Model):
    __tablename__ = 'users'
    id       = db.Column(db.Integer, primary_key=True)
    nome     = db.Column(db.String(100))
    email    = db.Column(db.String(120), unique=True)
    pontos   = db.Column(db.Integer, default=0)

# --- Minigame score -------------------------------------
class MinigameScore(db.Model):
    __tablename__ = 'minigame_scores'
    id        = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    score     = db.Column(db.Integer, nullable=False)
    created_at= db.Column(db.DateTime, default=datetime.datetime.utcnow)

# --- Garante que as tabelas existam assim que o módulo for importado ---
with app.app_context():
    db.create_all()

# --- FUNÇÕES AUXILIARES ---
@cache.memoize(timeout=3600)
def fetch_nasa_data(lat: float, lon: float, start_date: str, end_date: str) -> Dict[str, Any]:
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community":  "RE",
        "longitude":  lon,
        "latitude":   lat,
        "start":      start_date,
        "end":        end_date,
        "format":     "JSON"
    }
    resp = requests.get(url, params=params)
    if resp.status_code != 200:
        raise Exception(f"Erro NASA POWER: {resp.status_code}")
    data = resp.json()
    return data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]

def geocode_city(city_name: str) -> Optional[Tuple[float, float]]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": city_name, "format": "json", "limit": 1, "addressdetails": 0}
    headers = {"User-Agent": "EcoVivaApp/1.0 (Contato: gabrielnunesbr07@gmail.com)"}
    resp = requests.get(url, params=params, headers=headers)
    if resp.status_code != 200 or not resp.json():
        return None
    d = resp.json()[0]
    return float(d["lat"]), float(d["lon"])

# --- ROTAS DE PÁGINA ---
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/missao-valores")
def missao_valores():
    return render_template("missao_valores.html")


@app.route("/nossa-empresa")
def nossa_empresa():
    return render_template("nossa_empresa.html")


@app.route("/comunidades")
def comunidades_page():
    return render_template("comunidades.html")


@app.route("/doacoes")
def doacoes_page():
    return render_template("doacoes.html")

@app.route("/voluntariado")
def voluntariado():
    return render_template("voluntariado.html")

@app.route("/jogue")
def jogue():
    return render_template("minigame.html")

@app.route("/api/minigame_score", methods=["POST"])
def api_minigame_score():
    data  = request.get_json() or {}
    score = int(data.get("score", 0))
    uid   = data.get("user_id")          # pode vir None

    if score <= 0:
        return jsonify({"error": "score inválido"}), 400

    # grava pontuação
    db.session.add(MinigameScore(user_id=uid, score=score))

    impact = score // 10                 # regra simples: 10 pts → 1 Impact
    if uid:
        user = User.query.get(uid)
        if user:
            user.pontos = user.pontos + impact

    db.session.commit()
    return jsonify({"impact_points_added": impact})

# --- ROTAS DE API ---
@app.route("/api/geocode", methods=["GET"])
def api_geocode():
    city = request.args.get("city")
    if not city:
        return jsonify({"error": "Nenhuma cidade fornecida"}), 400
    coords = geocode_city(city)
    if coords is None:
        return jsonify({"error": "Não foi possível encontrar esta cidade."}), 404
    return jsonify({"city": city, "lat": coords[0], "lon": coords[1]})

@app.route("/inscricao_voluntario", methods=["POST"])
def inscricao_voluntario():
    """
    Recebe dados do formulário de voluntariado.
    Salve em log / banco / e-mail conforme sua necessidade.
    """
    nome  = request.form.get("nome", "")
    email = request.form.get("email", "")
    area  = request.form.get("area", "não informado")

    # exemplo simples: registra no log do app
    app.logger.info("Voluntário: %s <%s> — %s", nome, email, area)

    # redireciona de volta para a página de voluntariado
    return redirect(url_for("voluntariado"))

@app.route("/api/add_community", methods=["POST"])
def api_add_community():
    try:
        data = request.get_json() or {}
        if "id" not in data or "nome" not in data:
            raise ValueError("Dados inválidos")

        comm = Community(
            id           = data["id"],
            nome         = data["nome"],
            lat          = data["lat"],
            lon          = data["lon"],
            meta_doacao  = data.get("meta_doacao", 30000),
            doacao_atual = data.get("doacao_atual", 0)
        )
        db.session.add(comm)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/add_donation", methods=["POST"])
def api_add_donation():
    try:
        data = request.get_json() or {}
        cid    = data.get("community_id")
        # converte para Decimal desde o início
        amount = Decimal(str(data.get("amount", 0)))
        if not cid or amount <= 0:
            raise ValueError("Dados inválidos para doação")

        comm = Community.query.get(cid)
        if not comm:
            raise ValueError("Comunidade não encontrada")

        # cria o registro de doação
        donation = Donation(community_id=cid, amount=amount)
        # agora usamos Decimal + Decimal
        comm.doacao_atual = comm.doacao_atual + amount

        db.session.add(donation)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@app.route("/api/communities", methods=["GET"])
def get_communities():
    result = []
    for comm in Community.query.all():
        result.append({
            "id":           comm.id,
            "nome":         comm.nome,
            "lat":          float(comm.lat),
            "lon":          float(comm.lon),
            "meta_doacao":  float(comm.meta_doacao),
            "doacao_atual": float(comm.doacao_atual)
        })
    return jsonify(result)


@app.route("/api/irradiance", methods=["GET"])
def get_irradiance():
    cid       = request.args.get("community_id")
    start     = request.args.get("start_year")
    end       = request.args.get("end_year")
    comm      = Community.query.get(cid)
    if comm is None:
        return jsonify({"error": "Comunidade inválida"}), 400
    if not start or not end:
        return jsonify({"error": "Período de data inválido"}), 400

    try:
        data = fetch_nasa_data(float(comm.lat), float(comm.lon), start, end)
        dates = sorted(data.keys())
        end_available = dates[-1] if dates else None
        return jsonify({
            "community_id":      comm.id,
            "nome":              comm.nome,
            "irradiance":        data,
            "available_end_date": end_available
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/donation/<community_id>", methods=["GET"])
def get_donation(community_id):
    comm = Community.query.get(community_id)
    if comm is None:
        return jsonify({"error": "Comunidade não encontrada"}), 404
    return jsonify({
        "community_id": comm.id,
        "nome":         comm.nome,
        "meta_doacao":  float(comm.meta_doacao),
        "doacao_atual": float(comm.doacao_atual)
    })


@app.route("/plot/irradiance")
def plot_irradiance():
    cid   = request.args.get("community_id")
    start = request.args.get("start_year")
    end   = request.args.get("end_year")
    comm  = Community.query.get(cid)
    if comm is None:
        return "Comunidade inválida", 400
    if not start or not end:
        return "Período de data inválido", 400

    try:
        data = fetch_nasa_data(float(comm.lat), float(comm.lon), start, end)
    except Exception as e:
        return str(e), 500

    dates = sorted(data.keys())
    valid = [d for d in dates if data[d] != -999]
    vals  = [data[d] for d in valid]
    dt    = [datetime.datetime.strptime(d, "%Y%m%d") for d in valid]

    arr = np.array(vals)
    filt = arr[(arr > -50) & (arr < 50)]
    if filt.size == 0:
        txt = "Sem dados válidos."
    else:
        avg  = np.mean(filt)
        med  = np.median(filt)
        var  = np.var(filt, ddof=1)
        sd   = np.sqrt(var)
        sk   = (len(filt)/((len(filt)-1)*(len(filt)-2))) * np.sum(((filt-avg)/sd)**3) if len(filt)>2 else 0
        mx   = np.max(filt)
        mn   = np.min(filt)
        txt  = (f"Média: {avg:.2f} kWh/m²/dia\n"
                f"Mediana: {med:.2f} kWh/m²/dia\n"
                f"Variância: {var:.2f}\n"
                f"Desvio Padrão: {sd:.2f}\n"
                f"Assimetria: {sk:.2f}\n"
                f"Máximo: {mx:.2f} kWh/m²/dia\n"
                f"Mínimo: {mn:.2f} kWh/m²/dia")

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8),
                                   gridspec_kw={'height_ratios': [3, 1]})
    ax1.plot(dt, vals, marker='o', color='#4a7c59')
    ax1.set_title(f'Irradiância Diária - {comm.nome}')
    ax1.set_ylabel('Irradiância (kWh/m²/dia)')
    ax1.grid(True)
    ax1.xaxis_date()
    fig.autofmt_xdate()

    ax2.axis('off')
    ax2.text(0.5, 0.5, txt,
             fontsize=12, ha='center', va='center', transform=ax2.transAxes)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    plt.close(fig)
    buf.seek(0)
    return app.response_class(buf.getvalue(), mimetype='image/png')


if __name__ == "__main__":
    app.run(debug=True)
