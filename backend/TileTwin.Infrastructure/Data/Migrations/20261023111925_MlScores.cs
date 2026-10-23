using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TileTwin.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class MlScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnomalyScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MachineId = table.Column<string>(type: "text", nullable: false),
                    ModelVersion = table.Column<string>(type: "text", nullable: false),
                    Score = table.Column<double>(type: "double precision", nullable: false),
                    Threshold = table.Column<double>(type: "double precision", nullable: false),
                    MaxFeatureZ = table.Column<double>(type: "double precision", nullable: true),
                    ZThreshold = table.Column<double>(type: "double precision", nullable: true),
                    IsAnomaly = table.Column<bool>(type: "boolean", nullable: false),
                    TopDeviationsJson = table.Column<string>(type: "text", nullable: true),
                    TimestampUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataOrigin = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SeedBatchId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnomalyScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnomalyScores_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MlModels",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    MachineType = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "text", nullable: false),
                    EvaluationSummaryJson = table.Column<string>(type: "text", nullable: true),
                    TrainedUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DataOrigin = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    SeedBatchId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MlModels", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnomalyScores_MachineId_TimestampUtc",
                table: "AnomalyScores",
                columns: new[] { "MachineId", "TimestampUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnomalyScores");

            migrationBuilder.DropTable(
                name: "MlModels");
        }
    }
}
